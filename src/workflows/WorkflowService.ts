import { DataSource } from 'typeorm';
import { WorkflowStatusDTO } from '../dtos/WorkflowStatusDTO';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from './WorkflowFactory';

export class NotFoundItemError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundItemError';
    }
}

export class BadStatusError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BadStatusError';
    }
}

export class WorkflowService {
    constructor(private dataSource: DataSource) { }

    /**
     * Retrieves a workflow status by its ID.
     * @param workflowId - The ID of the workflow to retrieve.
     * @returns A promise that resolves to the Workflow entity.
     * @throws If the workflow is not found, it throws an error.
     */
    async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusDTO> {
        const repository = AppDataSource.getRepository(Workflow);
        const workflow = await repository.findOne({
            where: { workflowId: workflowId },
            relations: {
                tasks: {
                    result: true
                }
            }
        });
        if (!workflow) {
            throw new NotFoundItemError(`Workflow with ID ${workflowId} not found.`);
        }
        const allFinished = workflow.tasks.reduce((acc, t) => acc + ((t.status === TaskStatus.Completed || t.status === TaskStatus.Failed) ? 1 : 0), 0);
        return {
            workflowId: workflow.workflowId,
            status: workflow.status,
            completedTasks: allFinished,
            totalTasks: workflow.tasks.length
        };
    }

    /**
     * Retrieves a workflow result by its ID.
     * @param workflowId - The ID of the workflow to retrieve.
     * @returns A promise that resolves to the Workflow entity.
     * @throws If the workflow is not found, it throws an error.
     */
    async getWorkflowResult(workflowId: string): Promise<any> {
        const repository = AppDataSource.getRepository(Workflow);
        const workflow = await repository.findOne({
            where: { workflowId: workflowId }
        });
        if (!workflow) {
            throw new NotFoundItemError(`Workflow with ID ${workflowId} not found.`);
        }

        if (workflow.status === WorkflowStatus.InProgress) {
            throw new BadStatusError(`Workflow with ID ${workflowId} is still in progress.`);
        }

        const result = workflow.finalResult;
        if (result) {
            return JSON.parse(result);
        } else {
            throw new BadStatusError(`Workflow with ID ${workflowId} is still in progress.`);
        }
    }
}