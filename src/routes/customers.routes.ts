import { Router } from 'express';
import {
  list, getById, create, update, remove,
  listContacts, createContact, updateContactHandler, removeContact,
} from '../controllers/customers.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// customer CRUD
router.get('/',     requireRole('owner', 'admin', 'floor_manager'), list);
router.get('/:id',  requireRole('owner', 'admin', 'floor_manager'), getById);
router.post('/',    requireRole('owner', 'admin'), create);
router.patch('/:id', requireRole('owner', 'admin'), update);
router.delete('/:id', requireRole('owner', 'admin'), remove);

// contacts
router.get('/:id/contacts',                    requireRole('owner', 'admin', 'floor_manager'), listContacts);
router.post('/:id/contacts',                   requireRole('owner', 'admin'), createContact);
router.patch('/:id/contacts/:contactId',       requireRole('owner', 'admin'), updateContactHandler);
router.delete('/:id/contacts/:contactId',      requireRole('owner', 'admin'), removeContact);

export default router;
