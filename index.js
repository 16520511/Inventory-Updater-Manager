const express = require('express')
const app = express()
const ttdvUpdater = require('./crawlers/ttdv-updater')
const ifitnessUpdater = require('./crawlers/ifitness-updater')
let cron = require('node-cron');
const passport = require('./passport-setting')
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
let server = require('http').Server(app);

const UpdateTiming = require('./schema/update-timing');
var task1;
var task2;
//Chạy update tự động
function runUpdateAutomatically() {
    UpdateTiming.findOne({}, (err, time) => {
        console.log(time);
        if(time.everyMinute != null) {
            task1 = cron.schedule(`0 */${time.everyMinute} 6-23 * * *`, () => {
                console.log("cron1 running");
                ttdvUpdater()
            }, {
                timezone: 'Asia/Bangkok',
            });

            task2 = cron.schedule(`0 */${time.everyMinute+2} 6-23 * * *`, () => {
                console.log("cron2 running");
                ifitnessUpdater();
            }, {
                timezone: 'Asia/Bangkok',
            });
        }
        else {
            task1 = cron.schedule(`0 ${time.minute} ${time.hour} * * *`, () => {
                console.log("cron1 running");
                ttdvUpdater()
            }, {
                timezone: 'Asia/Bangkok',
            });
            console.log(`0 ${time.minute+3} ${time.hour} * * *`);
            task2 = cron.schedule(`0 ${time.minute+3} ${time.hour} * * *`, () => {
                console.log("cron2 running");
                ifitnessUpdater();
            }, {
                timezone: 'Asia/Bangkok',
            });
        }
        task1.start();
        task2.start();
    })
}

runUpdateAutomatically()

app.use(cookieSession({  name: 'session',  keys: ["secret"],  maxAge: 60 * 60 * 1000
}))
app.use(bodyParser.urlencoded({extended: true}));
app.use(passport.initialize());
app.use(passport.session());

const ProductChanges = require('./schema/product-changes');

global.io = require('socket.io')(server);

app.set('view engine', 'ejs')
const WooCommerceAPI = require('woocommerce-api');

//Setting woocommerce API
const WooCommerce = new WooCommerceAPI({    
  url: 'https://hoichomeo.com',
  consumerKey: 'ck_c0c2050592293ef0d22b69a874506e418662cdb4',
  consumerSecret: 'cs_09cc05f3389c7dd2235d1fb759b419ea1976267e',
  wpAPI: true,
  version: 'wc/v2'
});

app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/test', (req, res) => {
    UpdateTiming.findOne({}, (err, time) => {time.everyMinute = 5; time.save()})
})


//Middleware kiểm tra login
var checkLoggedIn = function (req, res, next) {
    if(req.isAuthenticated())
        next()
    else
        res.redirect("/login");
}

//Route cho login
app.route('/login')
.get((req, res) => {
    if(!req.isAuthenticated())
        res.render('login');
    else
        res.redirect("/")
})
.post(function(req, res, next) {passport.authenticate('local', function(err, user, info) {
    if (err) { return next(err); }
    if (!user) { return res.redirect('/login'); }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.redirect('/');
    });
})(req, res, next)});

//Route get cho trang chủ
app.get('/', checkLoggedIn, (req, res) => {
    UpdateTiming.findOne({}, (err, time) => {
        if(time.everyMinute != null)    res.render('home', {every: time.everyMinute, time: null});
        else res.render('home', {every: null, time: `${time.hour} giờ ${time.minute} phút`});
    })
})

//Route post cho trang chủ
app.post('/', checkLoggedIn, (req, res) => {
    if (req.body.name == "ttdv")
        ttdvUpdater();
    else if (req.body.name == "ifitness")
        ifitnessUpdater();
    res.json({success: true});
})

app.post("/update-timing", checkLoggedIn, (req, res) => {
    if (req.body.every != undefined)
        UpdateTiming.updateOne({}, {everyMinute: Number(req.body.every),
            hour: null,
            minute: null}, (err, time) => {
            task1.stop();
            task2.stop();
            runUpdateAutomatically();
            res.redirect('/')});
    else if (req.body.hour != undefined) {
        UpdateTiming.updateOne({}, {everyMinute: null, 
            hour: Number(req.body.hour),
            minute: Number(req.body.minute)}, (err, time) => {
            task1.stop();
            task2.stop();
            runUpdateAutomatically();
            res.redirect('/')});
    }
})

 //Route cho post request update 1 sản phẩm
app.post('/update-single-product', checkLoggedIn, (req, res) => {
    if(req.body.sku === undefined) res.json({success: false});
    else if(req.body.inStock != "Còn hàng" && req.body.inStock != "Hết hàng") res.json({success: false});
    else
    WooCommerce.get(`products?sku=${req.body.sku}`, function(err, data, result1) {
        if (err)
            res.json({success: false});
        if(result1 !== undefined)
        {
            try {
                if(JSON.parse(result1).length == 1)
                {
                    let product = JSON.parse(result1)[0];
                    let inStock = req.body.inStock == "Còn hàng" ? true : false;
                    let data = {
                        regular_price: req.body.price,
                        in_stock: inStock
                    }
                    WooCommerce.put(`products/${product.id}`, data, function(err, data, result2) {
                        if(err) res.json({success: false});
                        else {
                        let jsonRes = JSON.parse(result2);
                        ProductChanges.create({link: jsonRes.permalink, 
                            name: jsonRes.name,
                            sku: req.body.sku,
                            priceBefore: product.price,
                            priceAfter: req.body.price,
                            img: jsonRes.images[0].src,
                            inStock: inStock,
                            time: Date.now()}, (err, change) => {
                                console.log(change);
                        });
                        res.json({success: true});
                        }
                    });
                }
            } catch(e) {res.json({success: false});}
        }
    });
})

//Route lịch sử update
app.get('/history', checkLoggedIn, (req, res) => {
    ProductChanges.find({}).sort({time: -1}).exec((err, changes) => {
        res.render('history', {changes: changes});
    });
})

//Route request xóa lịch sử
app.post('/delete-history', checkLoggedIn, (req, res) => {
    ProductChanges.find({}).sort({time: -1}).exec((err, changes) => {
        for(let i = 0; i<req.body.indexes.length; i++) {
            let index = Number(req.body.indexes[i]);
            changes[index].remove();
        }
        res.json({success: true});
    });
})

//Route hiển thị tất cả sp
app.get('/manual-update', checkLoggedIn, (req, res) => {
    res.render("manual-update");
})

//Route gọi đến API Woo để lấy tất cả sp
app.post('/get-products', checkLoggedIn, (req, res) => {
    let productList = []
    WooCommerce.get(`products?per_page=100&page=1`, function(err, data, res1) {
        productList = productList.concat(JSON.parse(res1));
        WooCommerce.get(`products?per_page=100&page=2`, function(err, data, res2) {
            productList = productList.concat(JSON.parse(res2));
            WooCommerce.get(`products?per_page=100&page=3`, function(err, data, res3) {
                productList = productList.concat(JSON.parse(res3));
                WooCommerce.get(`products?per_page=100&page=4`, function(err, data, res4) {
                    productList = productList.concat(JSON.parse(res4));
                    WooCommerce.get(`products?per_page=100&page=5`, function(err, data, res5) {
                        productList = productList.concat(JSON.parse(res5));
                        WooCommerce.get(`products?per_page=100&page=6`, function(err, data, res6) {
                            productList = productList.concat(JSON.parse(res6));
                            res.json({products: productList});
                        });
                    });
                });
            });
        });
    });
})

app.post("/quick-update", checkLoggedIn, (req, res) => {
    let requestProducts = req.body.bulk_update.split("\n");
    for(let i = 0; i<requestProducts.length; i++) {
        let productInfo = requestProducts[i].split("/");
        console.log(productInfo);
        if (productInfo.length != 3)
            io.sockets.emit("quick-update", {sku: "xxxx", result: `Sai cú pháp, SKU ${productInfo[0]} không thể cập nhật`})
        else {
            let productSKU = productInfo[0];
            let productPrice = productInfo[1];
            let inStock = productInfo[2];
            if((inStock != "Còn hàng" && inStock != "Hết hàng" && inStock != "") || (productPrice == "" && inStock == ""))
                io.sockets.emit("quick-update", {sku: productSKU, result: `Có lỗi, SKU ${productInfo[0]} không thể cập nhật`})
            else {
                WooCommerce.get(`products?sku=${productSKU}`, function(err, data, result1) {
                    if (err)
                        io.sockets.emit("quick-update", {sku: productSKU, result: `Có lỗi, SKU ${productInfo[0]} không thể cập nhật`})
                    if(result1 !== undefined)
                    {
                        try {
                            if(JSON.parse(result1).length == 1)
                            {
                                let product = JSON.parse(result1)[0];
                                if (productPrice == "") {
                                    inStock = inStock == "Còn hàng" ? true : false;
                                    var data1 = {
                                        in_stock: inStock
                                    }
                                }
                                else if (inStock == "") {
                                    inStock = product.in_stock;
                                    var data1 = {
                                        regular_price: productPrice
                                    }
                                }
                                else {
                                    inStock = inStock == "Còn hàng" ? true : false;
                                    var data1 = {
                                        regular_price: productPrice,
                                        in_stock: inStock
                                    }
                                }
                                WooCommerce.put(`products/${product.id}`, data1, function(err, data2, result2) {
                                    if(err) io.sockets.emit("quick-update", {sku: productSKU, result: `Có lỗi, SKU ${productInfo[0]} không thể cập nhật`})
                                    else {
                                    let jsonRes = JSON.parse(result2);
                                    ProductChanges.create({link: jsonRes.permalink, 
                                        name: jsonRes.name,
                                        sku: productSKU,
                                        priceBefore: product.price,
                                        priceAfter: productPrice == "" ? product.price : productPrice,
                                        img: jsonRes.images[0].src,
                                        inStock: inStock,
                                        time: Date.now()}, (err, change) => {
                                            console.log(err);
                                            console.log(change);
                                    });
                                    io.sockets.emit("quick-update", {sku: productSKU, result: `SKU ${productInfo[0]} đã được cập nhật thành công`});
                                    }
                                });
                            }
                            else io.sockets.emit("quick-update", {sku: productSKU, result: `Có lỗi, SKU ${productInfo[0]} không thể cập nhật`})

                        } catch(e) {console.log(e); io.sockets.emit("quick-update", {sku: productSKU, result: `Có lỗi, SKU ${productInfo[0]} không thể cập nhật`})}
                    }
                });
            }
        }
    }
    res.json({success: true});
})

app.get('/logout', checkLoggedIn, (req, res) => {
    req.logOut();
    res.redirect("/login");
})

// app.get('/create-user', (req, res) => {
//     bcrypt.hash('duchuypro', 10, function(err, hash) {
//         User.create({username: "admin", password: hash}, (err, user) => {
//             res.send(user);
//         })
//     });
// })

const port = process.env.PORT || 3000;
server.listen(port, () => { console.log('server is running') });