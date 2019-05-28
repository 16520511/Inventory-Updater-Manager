const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productChangesSchema = new Schema({
    link: String,
    name: String,
    sku: String,
    priceBefore: String,
    priceAfter: String,
    img: String,
    time: Date
});

module.exports = mongoose.model('ProductChanges', productChangesSchema);