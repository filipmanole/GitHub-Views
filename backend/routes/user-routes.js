const router = require("express").Router();
const userCtrl = require("../controllers/UserCtrl");

router.get("/startsWith", userCtrl.getWhereUsernameStartsWith);
router.get("/getData", userCtrl.getData);

module.exports = router;
