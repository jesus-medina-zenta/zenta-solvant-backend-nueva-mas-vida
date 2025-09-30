export interface IPipelineService {
  triggerPipelineAfterAction(
    action: string,
    actionData: any,
    pipelineName?: string,
  ): Promise<any>;
}
