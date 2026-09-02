const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");
const ctrl    = require("../controllers/expenseCategoryController");

router.use(auth);
router.get("/",       ctrl.list);
router.post("/",      ctrl.create);
router.put("/:id",    ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
