import { In, Not, Repository } from "typeorm";
import { Job } from "./Job";
import { Task } from "../models/Task";
import { TaskStatus } from "../workers/taskRunner";

export class ReportGenerationJob implements Job {

    constructor(private readonly taskRepository: Repository<Task>) { }

    async run(task: Task): Promise<any> {
        console.log(`Generating report for task ${task.taskId}...`);

        const tasks = await this.taskRepository.find({
            where: {
                workflow: { workflowId: task.workflow.workflowId },
                status: In([TaskStatus.Completed, TaskStatus.Failed]),
            },
            order: { stepNumber: 'ASC' },
            relations: ['result']
        });

        const result = {
            workflowId: task.workflow.workflowId,
            tasks: tasks.map(t => ({
                taskId: t.taskId,
                type: t.taskType,
                status: t.status,
                output: t.result?.data ? JSON.parse(t.result.data) : null,
            })),
            finalReport: "Aggregated data and results"
        }

        console.log(`Job response for task ${task.taskId}:`, result);

        return result;
    }
}