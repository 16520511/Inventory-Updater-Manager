const crawler = require('crawler')
global.mongoose = require('mongoose');
const ProductChanges = require('../schema/product-changes');
const UpdateSession = require('../schema/update-session');

mongoose.connect('mongodb://lokatto:lokatto1@ds261116.mlab.com:61116/inven-updater', {useNewUrlParser: true})

const WooCommerceAPI = require('woocommerce-api');

const WooCommerce = new WooCommerceAPI({    
  url: 'https://hoichomeo.com',
  consumerKey: 'ck_c0c2050592293ef0d22b69a874506e418662cdb4',
  consumerSecret: 'cs_09cc05f3389c7dd2235d1fb759b419ea1976267e',
  wpAPI: true,
  version: 'wc/v2'
});

function ChangeViToEng(str) {
    //Đổi ký tự có dấu thành không dấu
    str = str.replace(/á|à|ả|ạ|ã|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/gi, 'a');
    str = str.replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/gi, 'e');
    str = str.replace(/i|í|ì|ỉ|ĩ|ị/gi, 'i');
    str = str.replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/gi, 'o');
    str = str.replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/gi, 'u');
    str = str.replace(/ý|ỳ|ỷ|ỹ|ỵ/gi, 'y');
    str = str.replace(/đ/gi, 'd');

    return str;
}


String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

var sessionId;
var counter = 0;
var SKUList = []
var c = new crawler({
    maxConnections: 1,
    callback: (err, res, done) => {
        if (err)
            console.log(err)
        else {
            var $ = res.$
            var a = $(".item-title a");
            for (var i = 0; i < a.length-1; i++)
            { 
                var href = a[i].attribs.href
                var c2 = new crawler();
                c2.queue([{
                    uri: 'https://www.thethaodaiviet.vn/' + href,
                    jQuery: true,
                    callback: function (error, res, done) {
                        if(error){
                            console.log(error);
                        }else{
                            var $ = res.$
                            var productPrice = $(".product-shop").find(".price-box").children().first().text().trim()
                            var productName = $(".product-name").text().trim().replaceAll("\\n", "").replaceAll("\\t", "")
                            var productSKUhtml = $(".list-unstyled li").eq(0).text().trim().replaceAll("\\n", "").replaceAll("\\t", "");

                            var productSKU = "";
                            for (var j = 14; j<productSKUhtml.length; j++)
                            {
                                if (productSKUhtml[j] == "/" || productSKUhtml[j] == ",")
                                    break; 
                                productSKU += productSKUhtml[j];
                            }

                            productSKU = productSKU.trim();

                            productSKU = ChangeViToEng(productSKU);

                            var productInStock;
                            if($(".in-stock").text() == "Còn hàng")
                                productInStock = true;
                            else
                                productInStock = false;

                            counter++;
                            console.log(counter + ": " + productSKU);

                            if (productPrice != '' && productPrice != 'Giá Bán:Liên hệ')
                            {
                                productPrice = productPrice.split(':')[1].split('VNĐ')[0].trim().replaceAll('.', '');
                            }

                            else if (productPrice == '')
                            {
                                productPrice = $(".product-shop").find(".price-block").children().first().text().trim().replaceAll('.', '').replaceAll("Giá Bán:", "").replaceAll(" VNĐ", "");
                            }

                            if(SKUList.indexOf(productSKU) == -1)
                            {
                            WooCommerce.get(`products?sku=${productSKU}`, function(err, data, res) {
                                if (err)
                                    console.log(err);
                                if(res !== undefined)
                                {
                                    try {
                                        if(JSON.parse(res).length == 1)
                                        {
                                            var product = JSON.parse(res)[0];
                                            if(productName == product.name) {
                                            SKUList.push(productSKU);
                                            if(product.price != productPrice && product.price != "" && productPrice != "Liên hệ")
                                            {
                                                console.log('first if runs ' + productSKU + ' ' + product.slug);
                                                if(product.in_stock != productInStock) {
                                                    io.sockets.emit('ttdv', {sku: productSKU, name: productName, newPrice: productPrice, inStock: productInStock});
                                                    var data = {
                                                        regular_price: productPrice,
                                                        in_stock: productInStock
                                                }}
                                                else {
                                                    io.sockets.emit('ttdv', {sku: productSKU, name: productName, newPrice: productPrice});
                                                    var data = {
                                                        regular_price: productPrice
                                                }}
                                                WooCommerce.put(`products/${product.id}`, data, function(err, data, res) {
                                                    try {
                                                        var jsonRes = JSON.parse(res);
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
                                                                }
                                                            })
                                                        })
                                                    } catch(e) {}
                                                });
                                            }
                                            else if(product.in_stock != productInStock) {
                                                console.log('second if runs ' + productSKU);
                                                io.sockets.emit('ttdv', {sku: productSKU, name: productName, price: productPrice, inStock: productInStock});
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
                                                                }
                                                            })
                                                        })
                                                    } catch(e) {}
                                                });
                                            }
                                            else {
                                                io.sockets.emit('ttdv', {sku: productSKU, name: productName, price: productPrice});
                                            }
                                            }
                                        }
                                    } catch(e)  {}

                                }
                            }); }
                        }
                        done();
                    }
                }])
            }
        }
        done();
    }
})

module.exports = function runQueue() {
    UpdateSession.create({dateCreated: Date.now()}, (err, session) => {
            sessionId = session._id;
            c.queue(['https://www.thethaodaiviet.vn/phu-kien-tap-gym.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-gym-b0-min0-max0-attr0-2-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-gym-b0-min0-max0-attr0-3-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-gym-b0-min0-max0-attr0-4-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-gym-b0-min0-max0-attr0-5-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-gym-b0-min0-max0-attr0-6-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-gym-b0-min0-max0-attr0-7-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-the-thao.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-the-thao-b0-min0-max0-attr0-2-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-the-thao-b0-min0-max0-attr0-3-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-the-thao-b0-min0-max0-attr0-4-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/phu-kien-tap-the-thao-b0-min0-max0-attr0-5-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/xa-don-xa-kep.html',
            'https://www.thethaodaiviet.vn/xa-don-xa-kep-b0-min0-max0-attr0-2-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/giay-bong-da.html',
            'https://www.thethaodaiviet.vn/mon-boi-loi.html',
            'https://www.thethaodaiviet.vn/mon-bong-chay.html',
            'https://www.thethaodaiviet.vn/con-lan-tap-bung.html',
            'https://www.thethaodaiviet.vn/yoga-aerobic.html',
            'https://www.thethaodaiviet.vn/dung-cu-the-hinh.html',
            'https://www.thethaodaiviet.vn/dung-cu-the-hinh-b0-min0-max0-attr0-2-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/dung-cu-the-hinh-b0-min0-max0-attr0-3-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/dung-cu-the-hinh-b0-min0-max0-attr0-4-goods_id-ASC.html',
            'https://www.thethaodaiviet.vn/dung-cu-the-hinh-b0-min0-max0-attr0-5-goods_id-ASC.html']);
    })
}




