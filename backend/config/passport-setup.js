const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GitHubStrategy = require("passport-github").Strategy;
const GitHubApiCtrl = require("../controllers/GitHubApiCtrl");
const RepositoryModel = require("../models/Repository.js");
const UserModel = require("../models/User");

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await UserModel.findById(id);
  done(null, user);
});

passport.use(
  new LocalStrategy(function(username, password, callback) {
    UserModel.findOne({ username }, function(err, user) {
      if (err) {
        return callback(err);
      }

      if (!user) {
        return callback(null, false, { message: "No user found." });
        // return callback("No user found.");
      }

      user.verifyPassword(password, function(err, isMatch) {
        if (err) {
          return callback(err);
        }
        if (!isMatch) {
          return callback(null, false, { message: "Invalid login." });
          // return callback("Invalid login.");
        }
        return callback(null, user);
      });
    });
  })
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GH_CLIENT_ID,
      clientSecret: process.env.GH_CLIENT_SECRET
      // callbackURL: "http://localhost:3000/api/auth/github/redirect"
    },
    async (accessToken, refreshToken, profile, done) => {
      const currentUser = await UserModel.findOne({ githubId: profile.id });

      if (currentUser) {
        const updatedUser = await UserModel.findOneAndUpdate(
          {
            githubId: profile.id
          },
          {
            token: accessToken
          }
        );
        done(null, updatedUser);
      } else {
        const newUser = await new UserModel({
          username: profile.username,
          githubId: profile.id,
          token: accessToken
        }).save();

        const repos = await GitHubApiCtrl.getUserRepos(newUser);

        const promises = repos.map(async repo => {
          const repoTrafficResponse = await GitHubApiCtrl.getRepoTraffic(
            repo.full_name,
            newUser.token
          );
          const { views } = repoTrafficResponse.data;
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);

          if (
            views.length !== 0 &&
            new Date(views[views.length - 1].timestamp).getTime() >=
              today.getTime()
          ) {
            views.pop();
          }

          await new RepositoryModel({
            user_id: newUser._id,
            reponame: repo.full_name,
            views
          }).save();
        });
        await Promise.all(promises);

        done(null, newUser);
      }
    }
  )
);