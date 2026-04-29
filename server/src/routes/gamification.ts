import { Router, type Request, type Response, type NextFunction } from 'express'
import { requireFirebaseAuth } from '../middleware/auth'
import { getGamificationData, updateStreak } from '../services/gamification'
import { logger } from '../logger'

const router = Router()

router.get('/', requireFirebaseAuth, async (req: Request, res: Response, next: NextFunction) => {
  console.log('GAMIFICATION ROUTE HIT');
  try {
    const uid = req.user!.uid
    await updateStreak(uid).catch((e) => logger.warn({ e }, 'streak update failed'))
    const data = await getGamificationData(uid)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

export const gamificationRouter = router
