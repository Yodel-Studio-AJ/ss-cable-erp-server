import { Router } from 'express';
import authRoutes          from './auth.routes';
import usersRoutes         from './users.routes';
import subCompaniesRoutes  from './sub-companies.routes';
import productGroupsRoutes from './product-groups.routes';
import attendanceRoutes    from './attendance.routes';
import customersRoutes     from './customers.routes';
import vendorsRoutes       from './vendors.routes';

const router = Router();

router.use('/auth',           authRoutes);
router.use('/users',          usersRoutes);
router.use('/sub-companies',  subCompaniesRoutes);
router.use('/product-groups', productGroupsRoutes);
router.use('/attendance',     attendanceRoutes);
router.use('/customers',      customersRoutes);
router.use('/vendors',        vendorsRoutes);

export default router;
