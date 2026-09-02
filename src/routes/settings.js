const router = require("express").Router();
const auth   = require("../middleware/auth");
const c      = require("../controllers/settingsController");

router.use(auth);

router.get("/profile",          c.getProfile);
router.put("/profile",          c.updateProfile);
router.post("/email/request",   c.requestEmailChange);
router.post("/email/confirm",   c.confirmEmailChange);
router.post("/photo",           c.uploadPhoto);
router.delete("/photo",         c.deletePhoto);
router.put("/locale",           c.saveLocale);
router.put("/password",         c.changePassword);

module.exports = router;
