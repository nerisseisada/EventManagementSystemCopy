const mongoose = require('mongoose');

const registrant = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email:String,
    home: String,
    mobile: String,
    tel: String,
    company: String,
    companyAddress: String,
    workMobileNumber: String,
    workTelephoneNumber: String,
    website: String,
    type: String,
    status: String,
    statusUpdatedAt: Date ,
    registrationDate: Date,
    registrationStatus: String,
})

const registrantList = mongoose.model("registrant", registrant);
module.exports = registrantList;