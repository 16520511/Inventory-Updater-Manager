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
    ProductChanges.find({}, (err, changes) => {
        res.render('history', {changes: changes});
    })
})


server.listen(3000 || process.env.PORT, () => { console.log('server is running') });