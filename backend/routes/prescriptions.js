const express = require('express');
const router = express.Router();
const {
  createPrescription,
  getAllPrescriptions,
  getPrescriptionById,
  updatePrescription,
  linkBillToPrescription,
  deletePrescription
} = require('../controllers/prescriptionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getAllPrescriptions)
  .post(createPrescription);

router.route('/:id/link-bill')
  .put(linkBillToPrescription);

router.route('/:id')
  .get(getPrescriptionById)
  .put(updatePrescription)
  .delete(deletePrescription);

module.exports = router;
