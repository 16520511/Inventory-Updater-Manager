const express = require('express')
const app = express()
const ttdvUpdater = require('./crawlers/ttdv-updater')
const ifitnessUpdater = require('./crawlers/ifitness-updater')
var cron = require('node-cron');

const ProductChanges = require('./schema/product-changes');

var server = require('http').Server(app);
global.io = require('socket.io')(server);

app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: true}))

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


//Chạy updater vào lúc 7:00 AM mỗi ngày
cron.schedule('00 00 7 * * 0-6', () => {
    ttdvUpdater();
  }, {
    timezone: 'Asia/Bangkok',
});

cron.schedule('00 04 7 * * 0-6', () => {
    ifitnessUpdater();
  }, {
    timezone: 'Asia/Bangkok',
});

//Chạy updater vào lúc 7:00 PM mỗi ngày
cron.schedule('00 03 20 * * 0-6', () => {
    ttdvUpdater();
  }, {
    timezone: 'Asia/Bangkok',
});

cron.schedule('00 06 20 * * 0-6', () => {
    ifitnessUpdater();
  }, {
    timezone: 'Asia/Bangkok',
});

//Route get cho trang chủ
app.get('/', (req, res) => {
    res.render('home');
})

//Route post cho trang chủ
app.post('/', (req, res) => {
    if (req.body.name == "ttdv")
        ttdvUpdater();
    else if (req.body.name == "ifitness")
        ifitnessUpdater();
    res.json({success: true});
})

 //Route cho post request update 1 sản phẩm
app.post('/update-single-product', (req, res) => {
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
                    var product = JSON.parse(result1)[0];
                    var inStock = req.body.inStock == "Còn hàng" ? true : false;
                    var data = {
                        regular_price: req.body.price,
                        in_stock: inStock
                    }
                    WooCommerce.put(`products/${product.id}`, data, function(err, data, result2) {
                        if(err) res.json({success: false});
                        else {
                        var jsonRes = JSON.parse(result2);
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
app.get('/history', (req, res) => {
    ProductChanges.find({}).sort({time: -1}).exec((err, changes) => {
        res.render('history', {changes: changes});
    });
})

//Route hiển thị tất cả sp
app.get('/all-products', (req, res) => {
    res.render("all-products");
})

//Route gọi đến API Woo để lấy tất cả sp
app.post('/get-products', (req, res) => {
    var productList = []
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

const port = process.env.PORT || 3000;
server.listen(port, () => { console.log('server is running') });