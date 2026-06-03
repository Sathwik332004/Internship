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
const { auditAction } = require('../middleware/audit');

router.use(protect);

router.route('/')
  .get(getAllPrescriptions)
  .post(auditAction({ module: 'Prescriptions', action: 'CREATE' }), createPrescription);

router.route('/:id/link-bill')
  .put(auditAction({ module: 'Prescriptions', action: 'UPDATE' }), linkBillToPrescription);

router.route('/:id')
  .get(getPrescriptionById)
  .put(auditAction({ module: 'Prescriptions', action: 'UPDATE' }), updatePrescription)
  .delete(auditAction({ module: 'Prescriptions', action: 'DELETE' }), deletePrescription);

module.exports = router;
