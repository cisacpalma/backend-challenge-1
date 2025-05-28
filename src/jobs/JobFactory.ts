import { Job } from './Job';
import { DataAnalysisJob } from './DataAnalysisJob';
import { EmailNotificationJob } from './EmailNotificationJob';
import { PolygonAreaJob } from './PolygonAreaJob';
import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { ReportGenerationJob } from './ReportGenerationJob';

const jobMap: Record<string, (taskRepository: Repository<Task>) => Job> = {
    'analysis': () => new DataAnalysisJob(),
    'notification': () => new EmailNotificationJob(),
    'area': () => new PolygonAreaJob(),
    'report': (taskRepository: Repository<Task>) => new ReportGenerationJob(taskRepository),
};

export function getJobForTaskType(taskType: string, taskRepository: Repository<Task>): Job {
    const jobFactory = jobMap[taskType];
    if (!jobFactory) {
        throw new Error(`No job found for task type: ${taskType}`);
    }
    return jobFactory(taskRepository);
}