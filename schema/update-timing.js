const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const updateTimingSchema = new Schema({
    hour: Number,
    minute: Number,
    everyMinute: Number
});

module.exports = mongoose.model('UpdateTiming', updateTimingSchema);