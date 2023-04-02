const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const { body, check, validationResult } = require("express-validator");
const flash = require("connect-flash");

const app = express();

// Connect to MongoDB
mongoose
  .connect(process.env.mongodb_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Set EJS as view engine
app.set("view engine", "ejs");
app.set("views", "./views");

// Middleware
app.use(express.json());
app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));
// create a middleware to pass flash messages to views
app.use(flash());
app.use((req, res, next) => {
  res.locals.error_message = req.flash("User not found");
  next();
});

// Schemas
const User = mongoose.model(
  "User",
  new Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
  })
);

//      Passport
passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      }
      bcrypt.compare(password, user.password, (err2, res) => {
        if (res) {
          return done(null, user); //  gucci
        } else {
          return done(null, false, { message: "Incorect password" });
        }
      });
    });
  })
);

//  cookies
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

//  keep global var of user
app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  next();
});

app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

// Routes
app.get("/", (req, res) => {
  res.render("index", {
    user: req.user,
  });
});
app.get("/sign-up", (req, res) => res.render("sign-up"));
app.post("/sign-up", [
  body("username", "Username required").trim().isLength({ min: 1 }),
  body("password", "Password must be at least 8 characters").isLength({
    min: 8,
  }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors.array());
      res.render("sign-up", { user: req.body, errors: errors.array() });
      return;
    }
    User.findOne({ username: req.body.username })
      .then((userr) => {
        //    User already exists, jump to error handling
        if (userr) {
          const error = new Error("User already exists!");
          error.statusCode = 422;
          throw error;
        }
        //    New user, proceed normally
        const user = new User({
          username: req.body.username,
          password: req.body.password,
        });
        bcrypt.hash(user.password, 10, (err, hashedPassword) => {
          user.password = hashedPassword;
          user.save((err) => {
            if (err) {
              return next(err);
            }
            res.redirect("/");
          });
        });
      })
      .catch((err) => {
        if (!err.statusCode) {
          err.statusCode = 500;
        }
        res.status(err.statusCode).render("sign-up", {
          userExists: true,
        });
        return;
      });
  },
]);
app.post(
  "/log-in",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
    failureFlash: true,
  })
);
app.get("/log-out", (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
