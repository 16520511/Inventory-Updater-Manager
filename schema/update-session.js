const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ProductChanges = require('./product-changes');

const updateSessionSchema = new Schema({
    dateCreated: Date,
    changes: [{ type: Schema.Types.ObjectId, ref: 'ProductChanges' }]
});

module.exports = mongoose.model('UpdateSession', updateSessionSchema);