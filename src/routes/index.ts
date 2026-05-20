import { Router } from 'express';
import authRoutes          from './auth.routes';
import usersRoutes         from './users.routes';
import subCompaniesRoutes  from './sub-companies.routes';
import productGroupsRoutes from './product-groups.routes';

const router = Router();

router.use('/auth',           authRoutes);
router.use('/users',          usersRoutes);
router.use('/sub-companies',  subCompaniesRoutes);
router.use('/product-groups', productGroupsRoutes);

export default router;
