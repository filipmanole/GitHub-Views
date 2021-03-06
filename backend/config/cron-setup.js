const cron = require("node-cron");
const GitHubApiCtrl = require("../controllers/GitHubApiCtrl");
const RepositoryModel = require("../models/Repository");
const UserModel = require("../models/User");
const TokenModel = require("../models/Token");
const chalk = require("chalk");

async function updateRepos() {
  console.log("Updating repositories...");

  const repos = await RepositoryModel.find().populate({
    path: "user_id",
    populate: { path: "token_ref" }
  });
  repos.forEach(async repoEntry => {
    if (repoEntry.user_id.token_ref) {
      const response = await GitHubApiCtrl.getRepoTraffic(
        repoEntry.reponame,
        repoEntry.user_id.token_ref.value
      ).catch(e =>
        console.log(
          chalk.bgRed(
            `Error updading repo ${repoEntry.reponame} of user ${repoEntry.user_id.username}`
          )
        )
      );
      if (response) {
        let viewsToUpdate = response.data.views;
        if (repoEntry.views.length !== 0) {
          const last = repoEntry.views[repoEntry.views.length - 1].timestamp;
          viewsToUpdate = viewsToUpdate.filter(info => {
            const timestampDate = new Date(info.timestamp);
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            if (
              timestampDate.getTime() > last.getTime() &&
              timestampDate.getTime() < today.getTime()
            ) {
              return true;
            }

            return false;
          });
        }
        repoEntry.views.push(...viewsToUpdate);
        repoEntry.save();
      }
    }
  });
}

async function checkForNewRepos() {
  console.log("Checking for new repos");

  const users = await UserModel.find({
    githubId: { $ne: null },
    token_ref: { $exists: true }
  }).populate("token_ref");

  users.forEach(async user => {
    const repos = await GitHubApiCtrl.getUserRepos(
      user,
      user.token_ref.value
    ).catch(e => console.log(`Error checkForNewRepos ${user.username}`));

    if (repos) {
      repos.forEach(async repo => {
        const repoEntry = await RepositoryModel.findOne({
          reponame: repo.full_name,
          user_id: user._id
        });

        if (repoEntry === null) {
          const repoTrafficResponse = await GitHubApiCtrl.getRepoTraffic(
            repo.full_name,
            user.token_ref.value
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
            user_id: user._id,
            reponame: repo.full_name,
            views
          }).save();
        }
      });
    }
  });
}

cron.schedule("25 12 * * *", () => {
  updateRepos();
  checkForNewRepos();
});
