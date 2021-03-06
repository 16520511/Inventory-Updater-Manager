const crawler = require('crawler')
const ProductChanges = require('../schema/product-changes');
const UpdateSession = require('../schema/update-session');
process.env.UV_THREADPOOL_SIZE = 128;
process.env.TZ = 'Asia/Bangkok' 

mongoose.connect('mongodb://lokatto:lokatto1@ds261116.mlab.com:61116/inven-updater', {useNewUrlParser: true})

const WooCommerceAPI = require('woocommerce-api');

const WooCommerce = new WooCommerceAPI({    
  url: 'https://hoichomeo.com',
  consumerKey: 'ck_c0c2050592293ef0d22b69a874506e418662cdb4',
  consumerSecret: 'cs_09cc05f3389c7dd2235d1fb759b419ea1976267e',
  wpAPI: true,
  version: 'wc/v2'
});

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

var sessionId;
var counter = 0;
var changesCounter = 0;

var c = new crawler({
    maxConnections: 3,
    callback: (err, res, done) => {
        if (err)
            console.log(err)
        else {
            var $ = res.$
            var a = $(".product-block .product-img a:first-child");
            for (var i = 0; i < a.length-1; i++)
            {
                var href = a[i].attribs['data-handle'];
                if(href == undefined) continue;
                var c2 = new crawler()
                c2.queue([{
                    uri: 'https://ifitness.vn' + href,
                    jQuery: true,
                    timeout: 30000,
                    callback: function (error, res, done) {
                        if(error){
                            console.log(error);
                        }else{
                            var $ = res.$
                            var productName = $(".product-title h1").eq(0).text();
                            var productSKU = $(".product-sku span").eq(1).text();
                            var productPrice = $(".product-price span").eq(1).text().replaceAll(",", "").replaceAll("₫", "");
                            var productCartBtn = $(".btn-cart-products").eq(0).text().trim().replaceAll("\\n", "").replaceAll("\\t", "");

                            if (productCartBtn == "Mua ngay")
                                var productInStock = true;
                            else
                                var productInStock = false;
                            counter++;
                            // console.log(counter + ": " + productSKU);

                            WooCommerce.get(`products?sku=${productSKU}`, function(err, data, res) {
                                if (err)
                                    console.log(err);
                                if(res !== undefined)
                                {
                                    try {
                                        if(JSON.parse(res).length == 1)
                                        {
                                            var product = JSON.parse(res)[0];
                                            if(product.price != productPrice)
                                            {
                                                if (product.in_stock != productInStock) {
                                                    io.sockets.emit('ifitness', {sku: productSKU, name: productName, newPrice: productPrice, inStock: productInStock});
                                                    var data = {
                                                        regular_price: productPrice,
                                                        in_stock: productInStock
                                                    };
                                                }
                                                else {
                                                    io.sockets.emit('ifitness', {sku: productSKU, name: productName, newPrice: productPrice});
                                                    var data = {
                                                        regular_price: productPrice
                                                    };
                                                }
                                                

                                                WooCommerce.put(`products/${product.id}`, data, function(err, data, res) {
                                                    try {
                                                        var jsonRes = JSON.parse(res);
                                                        ProductChanges.create({link: jsonRes.permalink, 
                                                        name: jsonRes.name,
                                                        sku: productSKU,
                                                        priceBefore: product.price,
                                                        priceAfter: productPrice,
                                                        img: jsonRes.images[0].src,
                                                        time: Date.now()}, (err, change) => {
                                                            UpdateSession.findById(sessionId, (err, session) => {
                                                                if (!err)
                                                                {
                                                                    session.changes.push(change);
                                                                    session.save();
                                                                    io.sockets.emit('ifitness_changes', {changes: session.changes.length});
                                                                }
                                                            })
                                                        })
                                                    } catch(e) {}
                                                });
                                            }
                                            else if(product.in_stock != productInStock) {
                                                io.sockets.emit('ifitness', {sku: productSKU, name: productName, price: productPrice, inStock: productInStock});
                                                var data = {
                                                    in_stock: productInStock,
                                                }
                                                WooCommerce.put(`products/${product.id}`, data, function(err, data, res) {
                                                    try {
                                                        var jsonRes = JSON.parse(res);
                                                        console.log(jsonRes);
                                                        ProductChanges.create({link: jsonRes.permalink, 
                                                        name: jsonRes.name,
                                                        sku: productSKU,
                                                        priceBefore: product.price,
                                                        priceAfter: productPrice,
                                                        img: jsonRes.images[0].src,
                                                        inStock: productInStock,
                                                        time: Date.now()}, (err, change) => {
                                                            UpdateSession.findById(sessionId, (err, session) => {
                                                                if (!err)
                                                                {
                                                                    session.changes.push(change);
                                                                    session.save();
                                                                    io.sockets.emit('ifitness_changes', {changes: session.changes.length});
                                                                }
                                                            })
                                                        })
                                                    } catch(e) {}
                                                });
                                            }
                                            else {
                                                io.sockets.emit('ifitness', {sku: productSKU, name: productName, price: productPrice});
                                            }
                                        }
                                    } catch(e)  {}

                                }
                            });
                        }
                        done();
                    }
                }])
            }    
        }
        done()
    }
})

module.exports = function runQueue() {
    UpdateSession.create({dateCreated: Date.now()}, (err, session) => {
            sessionId = session._id;
            c.queue(['https://ifitness.vn/collections/phu-kien-the-thao?page=1',
'https://ifitness.vn/collections/phu-kien-the-thao?page=2']);
    })
}




