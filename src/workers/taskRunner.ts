import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus } from "../workflows/WorkflowFactory";
import { Workflow } from "../models/Workflow";
import { Result } from "../models/Result";

export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

export class TaskRunner {
    constructor(
        private taskRepository: Repository<Task>,
    ) { }

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);
        const job = getJobForTaskType(task.taskType, this.taskRepository);
        const resultRepository = this.taskRepository.manager.getRepository(Result);

        let taskParams;

        if (task.dependsOn) {
            const dependencyTask = await this.taskRepository.findOne({
                where: {
                    taskType: task.dependsOn,
                    workflow: { workflowId: task.workflow.workflowId }
                },
                relations: ['result']
            });

            if (dependencyTask?.result?.data) {
                const input = dependencyTask.result.data;
                try {
                    const parsed = JSON.parse(input);
                    if (typeof parsed === 'object' && parsed !== null) {
                        taskParams = parsed;
                    } else {
                        taskParams = input;
                    }
                } catch (err) {
                    taskParams = input;
                }
            }
        }

        try {
            console.log(`Starting job ${task.taskType} for task ${task.taskId} with params: ${taskParams}`);
            const taskResult = await job.run(task, taskParams);
            console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);
            const result = new Result();
            // result.taskId = task.taskId!;
            result.data = JSON.stringify(taskResult || {});
            await resultRepository.save(result);
            task.result = result;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);

        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

            const result = new Result();
            // result.taskId = task.taskId!;
            result.data = error?.message || 'An error occurred while running the job';
            await resultRepository.save(result);

            task.status = TaskStatus.Failed;
            task.progress = null;
            task.result = result;
            await this.taskRepository.save(task);

            throw error;
        }

        const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
        const currentWorkflow = await workflowRepository.findOne({
            where: { workflowId: task.workflow.workflowId },
            relations: {
                tasks: {
                    result: true
                }
            }
        });

        if (currentWorkflow) {

            currentWorkflow.status = WorkflowStatus.InProgress;

            const allFinished = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed || t.status === TaskStatus.Failed);

            if (allFinished) {

                const allCompleted = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
                const anyFailed = currentWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

                if (anyFailed) {
                    currentWorkflow.status = WorkflowStatus.Failed;
                } else if (allCompleted) {
                    currentWorkflow.status = WorkflowStatus.Completed;
                }

                const result = {
                    tasks: currentWorkflow.tasks.map(t => ({
                        taskId: t.taskId,
                        type: t.taskType,
                        status: t.status,
                        output: t.result?.data ? JSON.parse(t.result.data) : null,
                    }))
                }

                currentWorkflow.finalResult = JSON.stringify(result);
            }

            await workflowRepository.save(currentWorkflow);
        }
    }
}