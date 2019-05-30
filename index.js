const express = require('express')
const app = express()
const ttdvUpdater = require('./crawlers/ttdv-updater')
const ifitnessUpdater = require('./crawlers/ifitness-updater')

const ProductChanges = require('./schema/product-changes');
const UpdateSession = require('./schema/update-session');

var server = require('http').Server(app);
global.io = require('socket.io')(server);

app.set('view engine', 'ejs')
app.use(express.urlencoded({extended: true}))

const WooCommerceAPI = require('woocommerce-api');

const WooCommerce = new WooCommerceAPI({    
  url: 'https://hoichomeo.com',
  consumerKey: 'ck_c0c2050592293ef0d22b69a874506e418662cdb4',
  consumerSecret: 'cs_09cc05f3389c7dd2235d1fb759b419ea1976267e',
  wpAPI: true,
  version: 'wc/v2'
});

app.get('/favicon.ico', (req, res) => res.status(204));

app.get('/', (req, res) => {
    res.render('home');
})

app.post('/', (req, res) => {
    console.log('this happened');
    if (req.body.name == "ttdv")
        ttdvUpdater();
    else if (req.body.name == "ifitness")
        ifitnessUpdater();
    res.json({success: true});
})

app.get('/history', (req, res) => {
    ProductChanges.find({}).sort({time: -1}).exec((err, changes) => {
        res.render('history', {changes: changes});
    });
})

app.get('/all-products', (req, res) => {
    // var page = req.query.page;
    // if(page === undefined) page = 1;
    // if(page <= 6) {
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
                            res.render("all-products", {products: productList});
                        });
                    });
                });
            });
        });
    });
    // }
})

const port = process.env.PORT || 3000;
server.listen(port, () => { console.log('server is running') });