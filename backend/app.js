var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var routesRouter = require('./routes/routes');

var app = express();

// Connect to MongoDB
const connectDB = require('./db');
connectDB();
require('./taskExpiryJob');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

app.use('/api', routesRouter);

module.exports = app;
