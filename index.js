const express = require('express');
const app = express();
const dotenv = require('dotenv');
const cors = require('cors');
const registrant = require("./routes/regroute");
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');

const port = process.env.PORT || 4000;
app.use(cookieParser());
app.use(session({
    secret:'cmxiuduieudur84fncdds',
    cookie: {maxAge: 60000},
    resave: false,
    saveUninitialized: false
}));
app.use(flash());

dotenv.config();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/node_modules', express.static(__dirname + '/node_modules'));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
  });
app.use('/', registrant);


// ----------ejs-------------
app.set('view engine', 'ejs');

try {
    require('mongoose').connect(process.env.DB);
} catch (error) {
    console.log(error);
}

app.listen(port, ()=>console.log(`Successfully connected to: http://localhost:${port}`))
