const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./schema/user')
const bcrypt = require('bcrypt')

passport.use(new LocalStrategy(
    function(username, password, done) {
      User.findOne({ username: username }, function (err, user) {
        if (err) { return done(err); }
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
        }
        bcrypt.compare(password, user.password, function(err, res) {
            if(res) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Incorrect password.' });
            }
        });
      });
    }
  ));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
    done(err, user);
    });
});

module.exports = passport;