import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { BadStatusError, NotFoundItemError, WorkflowService } from '../workflows/WorkflowService';

const router = Router();
const workflowService = new WorkflowService(AppDataSource);

router.get('/:id/status', async (req, res) => {
    try {
        const result = await workflowService.getWorkflowStatus(req.params.id);

        res.status(202).json(result);
    } catch (error: any) {
        console.error('Error retrieving workflow status:', error);
        if (error instanceof NotFoundItemError) {
            res.status(404).json({ message: `Workflow with ID ${req.params.id} not found.` });
        } else {
            res.status(500).json({ message: 'Failed to retrieve workflow status' });
        }
    }
});

router.get('/:id/result', async (req, res) => {
    try {
        const result = await workflowService.getWorkflowResult(req.params.id);

        res.status(202).json(result);
    } catch (error: any) {
        console.error('Error retrieving workflow status:', error);
        if (error instanceof NotFoundItemError) {
            res.status(404).json({ message: `Workflow with ID ${req.params.id} not found.` });
        } else if (error instanceof BadStatusError) {
            res.status(400).json({ message: `Workflow with ID ${req.params.id} is not completed yet.` });
        } else {
            res.status(500).json({ message: 'Failed to retrieve workflow status' });
        }
    }
});

export default router;