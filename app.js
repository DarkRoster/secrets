// Requires
require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

// Call Express
const app = express();

// App use and set
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));

app.use(session({
  secret: 'Our little secret.',
  resave: false,
  saveUninitialized: true,
}))

app.use(passport.initialize());
app.use(passport.session());

// Connect Mongoose
main().catch(err => console.log(err));

async function main() 
{  
    await mongoose.connect("mongodb://localhost:27017/userDB");
}

// Create Schema
const userSchema = new mongoose.Schema ({
  username: String,
  password: String,
  googleId: String,
  secret: String
});

// Import plugins for userSchema 
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Create Model
const User = new mongoose.model("User", userSchema);

// Default passport methods for model.Serialize and deserialize user.
passport.use(User.createStrategy());

passport.serializeUser(function(user,done)
{
  done(null, user.id);
});

passport.deserializeUser(function(id,done)
{
  User.findById(id,function (err, user) 
  {  
    done(err,user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/secrets",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);
  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

// Gets
app.get("/", function(req, res){
  res.render("home");
});

app.get("/auth/google", passport.authenticate('google',
{
  scope: ["profile"]
}));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/secrets');
});

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/secrets",function(req,res)
{
  User.find({"secret": {$ne: null}}, function(err,foundUser)
  {
    if(err)
    {
      console.log(err);
    }
    else
    {
      if(foundUser)
      {
        res.render("secrets",{usersWithSecrets: foundUser});
      }
      else
      {
        console.log("Kullan??c?? bulunamad??.");
      }
    }
    
  });
});

app.get("/submit",function(req,res)
{
  if(req.isAuthenticated()){
    res.render("submit");
  }else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req,res){
  req.logout((err)=>{
      if(err){
          console.log(err);
      }else{
          res.redirect("/");
      }
  });
});

// Posts
app.post("/submit",function (req,res) 
{  
  const submittedSecret = req.body.secret;
  console.log(req.user.id);

  User.findById(req.user.id, function (err,foundUser) 
  {  
    if(err)
    {
      console.log(err)
    }
    else
    {
      if(foundUser)
      {
        foundUser.secret = submittedSecret;
        foundUser.save(function () 
        {  
          res.redirect("/secrets")
        });
      }
      else
      {
        console.log("Kullan??c?? bulunamad??.")
      }
    }
  });

});


app.post("/register", function(req, res){
  User.register({username: req.body.username},req.body.password,function (err, user) 
  {  
    if(err){
      res.redirect("/");
    }else{
      passport.authenticate("local")(req,res,function () 
      {  
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function (err) 
  {  
    if(err){
      console.log(err);
    }else{
      passport.authenticate("local")(req,res,function () 
      {  
        res.redirect("/secrets");
      });
    }
  });
});

// Listen
app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
