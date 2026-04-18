import { Router } from 'express'
import { requireFirebaseAuth } from '../middleware/auth.js'
import { getGamificationData, updateStreak } from '../services/gamification.js'
import { logger } from '../logger.js'

const router = Router()

router.get('/', requireFirebaseAuth, async (req, res) => {
  const { uid } = req.user
  try {
    await updateStreak(uid).catch((e) => logger.warn({ e }, 'streak update failed'))
    const data = await getGamificationData(uid)
    res.json(data)
  } catch (err) {
    logger.error({ err, uid }, 'gamification route failed')
    res.status(500).json({ error: 'Failed to fetch gamification data' })
  }
})

export const gamificationRouter = router
