import { Router } from 'express';
import { login, register, refresh, logout, me, updatePassword } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
router.patch('/me/password', requireAuth, updatePassword);

export default router;
