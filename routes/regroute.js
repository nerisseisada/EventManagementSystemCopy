const express = require('express');
const router = express.Router();
const registrantmodel = require('../model/registrant');
const nodemailer = require('nodemailer');
const qr = require('qr-image');
const jwt = require('jsonwebtoken');
const login = require("../model/user");
const XLSX = require('xlsx');
const bcrypt =require('bcrypt');
const multer = require('multer');

//upload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ------------ get users from database --------------
router.get('/reg', (req, res)=>{
  registrantmodel.find().then(data=>{
    res.send(data);
  })
})

// ---------------------login-------------------------
const secretKey = 'cfdf45ttrg554gfg445454sd';
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.redirect('/login');

    req.user = user;
    next();
  });
};
// -------- form content ----------
router.get("/form-content", (req, res)=>{

  res.render("pages/form_content");
});

// --------user-------------------
router.post('/user', (req,res,next)=>{
    login.create(req.body).then(data=>{
        res.send("Successfully created: " + data)
    })
})

router.get('/user', (req,res,next)=>{
  login.find().then((data)=>{
    res.send(data)})
})

router.get('/usersearch', async (req, res) => {
  try {
    const searchQuery = req.query.search;
    const data = await login.find({
      $or: [
        { username: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { role: { $regex: searchQuery, $options: 'i' } },
      ],
    });

    res.render('partials/userTableBody', {
      data: data,
    });
  } catch (err) {
    console.error(err);
    res.render('pages/error');
  }
});

router.post('/admin/:id', (req,res,next)=>{
  login.findByIdAndUpdate(req.params.id, req.body).then(()=>{
    login.findById(req.params.id).then(data=>{
      res.redirect("/admin");
    })
  })
})

// ------ customer service -------------
router.get('/help&support', authenticateToken, async (req, res) =>{

  const user = await login.findById(req.user.id);
  res.render('pages/customer_service', {
    user
  });
});

// ------ edit profile -----------------
router.get('/my-profile', authenticateToken, async (req, res) => {
  try {
    const user = await login.findById(req.user.id);
    const userlist = await login.find();
    const formData = req.session.formData || {};
    
      if (!user) {
        res.render('pages/error');
      }
      res.render('pages/editprofile', { 
        user, error : req.flash('error'), formData, updatemessage: req.flash('updatemessage'),deletemessage:  req.flash('deletemessage'), data: userlist,
      });

  } catch (error) {
    console.error(error);
    res.render('pages/error');
  }
});

// ------control panel------------------
router.get('/admin', authenticateToken, async (req, res) => {
  try {
    const user = await login.findById(req.user.id);
    const userlist = await login.find();
    const formData = req.session.formData || {};

    if (!user) {
      res.render('pages/error');
    }
    res.render('pages/controlpanel', { 
      user, error : req.flash('error'), formData, notmatch: req.flash('notmatch'), success: req.flash('success'),updatemessage: req.flash('updatemessage'),deletemessage:  req.flash('deletemessage'), data: userlist,
    });
  } catch (error) {
    console.error(error);
    res.render('pages/error');
  }
});

router.post('/admin', async(req, res)=>{

  const { username, email, password, role, confirmpassword} = req.body;
  const existingUser = await login.findOne({ email: email });

  try {
  if (existingUser) {
    req.session.formData = { username, email, password, role };
    req.flash('error', 'Email address is already registered.');
    res.redirect('/admin');
  }
  else{
    if (password !== confirmpassword) {
      req.session.formData = { username, email, role };
      req.flash('notmatch', 'Password and confirm password are not match.');
      res.redirect('/admin');
    } else{
      const newRegistrant = new login({
        username, email, password, role
      });
  
      await newRegistrant.save();
      console.log('Data saved to the database.');
      req.session.formData = null;

      req.flash('success', 'User successfully added!');
      res.redirect('/admin');
      }
    }
    
  }
  catch (error) {
    console.error('Error saving data to the database:', error);
    res.render('pages/error');
  }


});

router.post('/edit-profile/:id', async (req, res, next) => {
  const id = req.params.id;
  const updatedData = req.body;
  const { username, email, role} = req.body;
  const existingUser = await login.findOne({ email: email });

  try {
    const originalUserData = await login.findById(id);
    const inputpassword = updatedData.currentpassword;
    const currentpassword = originalUserData.password;
    const newpassword = updatedData.newpassword;
    var confirmpassword = updatedData.confirmpassword;
    const data = await login.find();

    if (existingUser) {
      req.session.formData = { username, email, role };
      req.flash('error', 'Email address is already registered.');
      res.redirect('/my-profile');
    }
    else{
    if (!originalUserData) {
      res.render('pages/error');
    }

    if (inputpassword!== "") {
      if (inputpassword !== currentpassword) {
        req.flash('incorrectpass', 'Incorrect current password (Ignore this if you have no changes in password).');
        return res.render('pages/editprofile', { 
          user: originalUserData, notmatch: req.flash('notmatch'), 
          updatemessage: req.flash('updatemessage'), 
          incorrectpass: req.flash('incorrectpass'), 
          deletemessage:  req.flash('deletemessage'),
          data:data
        });
      }

      if (newpassword !== confirmpassword) {
        req.flash('notmatch', 'New password and confirm password are not match (Leave it blank if you have no changes in password)');
        req.flash('updatemessage', 'No changes detected');
        return res.render('pages/editprofile', { 
          user: originalUserData, notmatch: req.flash('notmatch'), 
          updatemessage: req.flash('updatemessage'), 
          incorrectpass: req.flash('incorrectpass'), 
          deletemessage:  req.flash('deletemessage'),
          data:data
        });
      } else {
        if (confirmpassword === "") {
          confirmpassword = currentpassword;
          req.flash('updatemessage', 'No changes detected. Kindly complete the password field. Leave it all blank if password update is not included');
          return res.render('pages/editprofile', { 
            user: originalUserData, notmatch: req.flash('notmatch'), 
            updatemessage: req.flash('updatemessage'), 
            incorrectpass: req.flash('incorrectpass'), 
            deletemessage:  req.flash('deletemessage'),
            data:data
          });
        } else {
          await login.findByIdAndUpdate(id, { password: confirmpassword });
        }
      }

    }

    await login.findByIdAndUpdate(id, updatedData);
    const user = await login.findById(id);
    
    if (!user) {
      res.render('pages/error');
    }

    req.flash('updatemessage', 'Successfully Updated data.');
    return res.render('pages/editprofile', { 
      user, updatemessage: req.flash('updatemessage') , 
      deletemessage:req.flash('deletemessage', 'Successfully deleted.'),
      data: data
  });

   }//else

  } catch (error) {
    console.error(error);
    req.flash('updatemessage', 'Error updating data.');
    return res.render('pages/editprofile', { user: originalUserData, updatemessage: req.flash('updatemessage') });
  }
});

router.put('/edit/:id',async (req,res)=>{
  await login.findByIdAndUpdate(req.params.id, req.body).then(async ()=>{
    await login.findById(req.params.id).then(data=>{
       res.send("updated: " + data)
    })
  });
})

router.get('/', authenticateToken, async(req, res) => {
  const user = await login.findById(req.user.id);
  const formData = req.session.formData || {};
  delete req.session.formData;

  res.render('pages/index', { user, error : req.flash('error') ,success : req.flash('success'), formData, email: req.user.email });
});

router.get('/login', (req, res) => {
  res.render('pages/login', { showError: false }); // Set showError to false initially
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await login.findOne({ email, password });

    if (!user) {
      return res.render('pages/login', { showError: true });
    }

    const token = jwt.sign({ id: user.id, username: user.email }, secretKey);
    res.cookie('token', token, { httpOnly: true });

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.render('pages/error');
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// ---------------------reports-------------------------
router.get('/reports', authenticateToken, async (req, res) => {
  try {
    const user = await login.findById(req.user.id);
    const registrationData = await registrantmodel.find({}, 'registrationDate');

    const registrationCounts = {};
    const registrationCountsMonth = {};
    const registrationCountsYear = {};

    registrationData.forEach((entry) => {
      if (entry.registrationDate) {
        const isoDateString = entry.registrationDate.toISOString();
        const date = isoDateString.substring(0, 10);
        const year = isoDateString.substring(0, 4);
        const month = isoDateString.substring(0, 7);

        registrationCounts[date] = (registrationCounts[date] || 0) + 1;
        registrationCountsMonth[month] = (registrationCountsMonth[month] || 0) + 1;
        registrationCountsYear[year] = (registrationCountsYear[year] || 0) + 1;
      }
    });

    // Find the peak day
    const peakDay = Object.keys(registrationCounts).reduce((maxDay, currentDay) => {
      return registrationCounts[currentDay] > registrationCounts[maxDay] ? currentDay : maxDay;
    }, Object.keys(registrationCounts)[0]); 

    const peakCount = { [peakDay]: registrationCounts[peakDay] };

    registrantmodel.find().then(data=>{
      res.render('pages/reports', {
        user,
        data: data,
        registrationCounts: JSON.stringify(registrationCounts),
        countPerMonth: JSON.stringify(registrationCountsMonth),
        countPerYear: JSON.stringify(registrationCountsYear),
        peakDay: peakDay,
        peakCount: peakCount[peakDay]
      });
    })
  } catch (error) {
    console.error(error);
    res.render('pages/error');
  }
});


// ------------------------- reports eventparticipants -------------------------------------
router.get('/reports/event-participants', authenticateToken, async (req, res) => {
  try {

    // const eventParticipant = await registrantmodel.find({ statusUpdatedAt: { $ne: null } }, 'statusUpdatedAt firstName lastName email company type registrationStatus');
    const eventParticipant = await registrantmodel.find({ status: { $ne: "Registrant" } }, 'statusUpdatedAt firstName lastName email company type registrationStatus');

    const eventParticipantCounts = {};
    const eventParticipantCountsMonth = {};
    const eventParticipantCountsYear = {};

    eventParticipant.forEach((entry) => {
      if (entry.statusUpdatedAt) {
        const isoDateString = entry.statusUpdatedAt.toISOString();
        const date = isoDateString.substring(0, 10);
        const year = isoDateString.substring(0, 4);
        const month = isoDateString.substring(0, 7);

        eventParticipantCounts[date] = (eventParticipantCounts[date] || 0) + 1;
        eventParticipantCountsMonth[month] = (eventParticipantCountsMonth[month] || 0) + 1;
        eventParticipantCountsYear[year] = (eventParticipantCountsYear[year] || 0) + 1;
      }
    });

    // Find the peak day
    const peakDay = Object.keys(eventParticipantCounts).reduce((maxDay, currentDay) => {
      return eventParticipantCounts[currentDay] > eventParticipantCounts[maxDay] ? currentDay : maxDay;
    }, Object.keys(eventParticipantCounts)[0]); 

    const peakCount = { [peakDay]: eventParticipantCounts[peakDay] };
    const user = await login.findById(req.user.id);

    res.render('pages/eventParticipants', {
      user,
      data: eventParticipant,  // Pass filtered data here
      eventParticipantCounts: JSON.stringify(eventParticipantCounts),
      eventParticipantCountsMonth: JSON.stringify(eventParticipantCountsMonth),
      eventParticipantCountsYear: JSON.stringify(eventParticipantCountsYear),
      peakDay: peakDay,
      peakCount: peakCount[peakDay]
    });

  } catch (error) {
    console.error(error);
    res.render('pages/error');
  }

});


// --------------------------------update status ----------------------------
router.post('/scan', async (req, res) => {
    try {
      const scannedData = req.body.scannedData;
      const user = await registrantmodel.findOne({ _id: scannedData });
      if (!user) {
        res.render('pages/error');
      }
      user.status = 'Participant';
      user.statusUpdatedAt = new Date()
      await user.save();
  
      return res.json({ message: 'User status updated to participant' });
    } catch (error) {
      console.error(error); 
      res.render('pages/error');
    }
});
// --------------------------------update details ----------------------------
router.post('/scan/:id', async (req, res, next) => {
  const id = req.params.id;
  const updatedData = req.body;

  if (updatedData.status === "Participant") {
    updatedData.statusUpdatedAt = new Date();
  }

  try {
      await registrantmodel.findByIdAndUpdate(id, updatedData);
      req.flash('updatemessage', 'Successfully Updated data.');
      res.redirect("/about");
  } catch (error) {
    res.render('pages/error');
  }
});


// -------------------------- about -------------------------------------
router.get("/about", authenticateToken, async (req, res, next) => {
  try {
    const user = await login.findById(req.user.id);
    const data = await registrantmodel.find();

    res.render('pages/about', {
      user,
      data,
      deleteMessage: req.flash('deleteMessage'),
      updatemessage: req.flash('updatemessage'),
      skippedEmails: req.flash('skippedEmails'),
      skippedRows: req.flash('skippedRows'),
    });
   } catch (error) {
    // Handle the error appropriately
    console.error('Error rendering about page:', error);
    res.render('pages/error');
   }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    
    if (!req.file) {
      res.render('pages/error');
    }

    const allowedFileTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (!allowedFileTypes.includes(req.file.mimetype)) {
      req.flash('error', 'Invalid file type. Please upload a CSV or XLS file.');
      return res.redirect('/import-registrant');
    }
    const data = [];
    const skippedRows = [];
    const skippedEmails = [];
    const existingEmails = new Set();

    const xlsx = require('xlsx');
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    for (let i = 2; ; i++) {
      const currentCell = sheet[`A${i}`];

      if (!currentCell || currentCell.v === undefined || currentCell.v === null) {
        // skippedRows.push(`Make sure you are following the sample format.`);
        break;
      }
      
      const email = sheet[`C${i}`]?.v;

      // email exists in excel
      if (existingEmails.has(email)) {
        console.warn(`Skipping duplicate email at Row ${i}: ${email}`);
        skippedEmails.push(`${email}`);
        continue;
      }

      // email exists in the database
      const existingRecord = await registrantmodel.findOne({ email });
      if (existingRecord) {
        console.warn(`Skipping existing email at Row ${i}: ${email}`);
        skippedEmails.push(`${email}`);
        continue;
      }
      
      // Check for required data missing
      if (!sheet[`A${i}`]?.v || !sheet[`B${i}`]?.v || !email || !sheet[`L${i}`]?.v || !sheet[`O${i}`]?.v || !sheet[`P${i}`]?.v) {
        console.warn(`Skipping row at Row ${i}: Required data missing`);
        skippedRows.push(`${i}`);
        continue;
      }


      const item = {
        firstName: sheet[`A${i}`]?.v,
        lastName: sheet[`B${i}`]?.v,
        email: email,
        home: sheet[`D${i}`]?.v,
        mobile: sheet[`E${i}`]?.v,
        tel: sheet[`F${i}`]?.v,
        company: sheet[`G${i}`]?.v,
        companyAddress: sheet[`H${i}`]?.v,
        workMobileNumber: sheet[`I${i}`]?.v,
        workTelephoneNumber: sheet[`J${i}`]?.v,
        website: sheet[`K${i}`]?.v,
        type: sheet[`L${i}`]?.v,
        status: sheet[`M${i}`]?.v,
        statusUpdatedAt: sheet[`N${i}`]?.v,
        registrationStatus: sheet[`O${i}`]?.v,
        registrationDate: sheet[`P${i}`]?.v,
      };

      data.push(item);
      
      existingEmails.add(email);
    }
    
    await registrantmodel.insertMany(data);

    if (skippedRows.length > 0) {
      const existingSkippedRows = req.flash('skippedRows') || [];
      const allSkippedRows = existingSkippedRows.concat(skippedRows);

      req.flash('skippedRows', allSkippedRows);
    }

    if (skippedEmails.length > 0) {
      const existingSkippedEmails = req.flash('skippedEmails') || [];
      const allSkippedEmails = existingSkippedEmails.concat(skippedEmails);

      req.flash('skippedEmails', allSkippedEmails);
    }
   
    res.redirect('/about');

  } catch (error) {
    res.render('pages/error');
  }
});


// -------------------------- import registrant -------------------------------------------

router.get('/import-registrant',authenticateToken, async(req, res) => {
  try{
    const user = await login.findById(req.user.id);
    res.render('pages/importRegistrant', {user, error: req.flash('error'),});
  }catch (error){
    // res.status(500).send('Error processing page. Please contact the developer for this.')
    res.render('pages/error');
  }
});

// -------------------------- search feature in about -------------------------------------
router.get('/search', authenticateToken, async(req, res) => {
  const searchQuery = req.query.search;
  const user = await login.findById(req.user.id);
  registrantmodel
  .find({
    $or: [
      { firstName: { $regex: searchQuery, $options: 'i' } },
      { lastName: { $regex: searchQuery, $options: 'i' } },
      { type: { $regex: searchQuery, $options: 'i' } },
      { email: { $regex: searchQuery, $options: 'i' } },
      { status: { $regex: searchQuery, $options: 'i' } },
      { company: { $regex: searchQuery, $options: 'i' } }
    ]
  })
    .then(data => {
      res.render('pages/about', {
        user,
        data: data,
        deleteMessage: req.flash('deleteMessage'),
        updatemessage: req.flash('updatemessage'),
        skippedEmails: req.flash('skippedEmails'),
        skippedRows: req.flash('skippedRows'),
        searchQuery: searchQuery,
      });
    })
    .catch(err => {
      console.error(err);
      res.redirect('/connection-error');
    });
});

router.get("/scan",authenticateToken, async(req,res,next)=>{
    const user = await login.findById(req.user.id);
    res.render("pages/scanner",{user})
})


router.post("/", async (req, res, next) => {
  try {

    const { firstName, lastName, email, home, mobile, tel, company, companyAddress, workMobileNumber, workTelephoneNumber, website, type } = req.body;
    const existingRegistrant = await registrantmodel.findOne({ email: email });

    if (existingRegistrant) {
        req.session.formData = { firstName, lastName, email, home, mobile, tel, company, companyAddress, workMobileNumber, workTelephoneNumber, website, type };
        req.flash('error', '* Email address is already registered.');
        res.redirect('/');
    }
    else{
      const data = await registrantmodel.create(req.body);
      const qrCodeData = JSON.stringify(data._id);
      const qrCode = qr.imageSync(qrCodeData, { type: 'png' });
      const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: process.env.USER,
              pass: process.env.PASS
          }
      });

      const mailOptions = {
          from: process.env.USER,
          to: req.body.email,
          subject: 'QR code for your Registration',
          html: `Hi ${req.body.firstName} ${req.body.lastName}, <br/>
                  Sending this email for your successful registration. 
                  Kindly save this QR code for the event. <br/><br/>
                  Thank you!
                  <br/>
                  <img src="cid:qrcode">`, 
          attachments: [{
              filename: 'qrcode.png',
              content: qrCode, 
              cid: 'qrcode' 
          }]
      };

      transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
              console.log(error);
          } else {
              console.log('Email sent: ' + info.response);
          }
      });
      req.flash('success', 'Form submitted successfully.');
      res.redirect('/');
    }
    
  } catch (error) {
      console.error(error);
      res.render('pages/error');
  }
});

router.post("/email-form", async (req, res) => {
  try{
    var transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.USER,
        pass: process.env.PASS
      }
    });
    const {inputEmail} = req.body;

    const mail ={
          from: process.env.USER,
          to: inputEmail,
          subject: 'Euodoo Technologies | Events  Help & Support',
          html: 
          `<div class="card container" style="padding: 5%; color: black">
          <div class="card-body" >
            <p class="card-title">Hello, </p>
            <p class="card-text">Thank you for reaching out to us through our customer service page. We have received your 
            support request and are eager to assist you. How may we be of service to you?</p>
          </div>
          <div class="card-footer">
              <br/>
              <hr>
              © 2023 | Euodoo Technologies Inc., 10/F One Global Place 25th Street cor. 5th Avenue Bonifacio Global City, 
              Taguig 1632 Philippines | www.euodoo.com.ph
          </div>
  </div>


`
    };
    transporter.sendMail(mail, (error, info) => {
      if (error) {
        return res.status(500).send(error.toString());
      }
    });
    res.redirect("/help&support");
  }
  catch (error){
    res.render('pages/error');
  }
})

router.delete('/deleteall', async (req,res,next)=>{
    await registrantmodel.deleteMany().then(()=>{
        res.send("Successfully deleted")
    })
})

router.post('/delete/:id', async (req, res, next) => {
    try {
        await registrantmodel.findByIdAndRemove(req.params.id).exec();
        req.flash('deleteMessage', 'Successfully deleted.');
        res.redirect('/about');
    } catch (error) {
      res.render('pages/error');
    }
});

router.post('/deleteuser/:id', async (req, res, next) => {
  try {
      await login.findByIdAndRemove(req.params.id).exec();
      req.flash('deleteMessage', 'Successfully deleted.');
      res.redirect('/admin');
  } catch (error) {
    res.render('pages/error');
  }
});

// ---------------------------tester email-------------------------
router.post('/send', (req, res, next)=>{

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.USER,
    pass: process.env.PASS
  }
});

var mailOptions = {
  from: process.env.USER,
  to: 'vmmiranda@euodoo.com.ph',
  subject: 'Sending Email using Node.js',
  text: 'That was easy!'
};

transporter.sendMail(mailOptions, function(error, info){
  if (error) {
    console.log(error);
  } else {
    console.log('Email sent: ' + info.response);
  }
});
})


// ------------ page not found -----------------------
router.use((req, res, next) => {
  res.status(404).render('pages/pagenotfound');
});




module.exports = router;

// email format-----------------
    // var mailOptions = {
    //     from: '"Our Code World " vivian614miranda@gmail.com', // sender address (who sends)
    //     to: 'vmmiranda@euodoo.com.ph', // list of receivers (who receives)
    //     subject: 'Hello', // Subject line
    //     text: 'Hello world ', // plaintext body
    //     html: '<b>Hello world </b><br> This is the first email sent with Nodemailer in Node.js' // html body
    // };

    