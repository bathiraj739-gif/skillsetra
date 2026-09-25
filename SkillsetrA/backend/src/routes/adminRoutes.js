import express from 'express'
import { getDashboardStats, getActivityLogs } from '../controllers/adminController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { adminMiddleware } from '../middleware/adminMiddleware.js'

const router = express.Router()

router.use(authMiddleware)
router.use(adminMiddleware)

router.get('/stats', getDashboardStats)
router.get('/activities', getActivityLogs)

export default router
