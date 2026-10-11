export type NotificationAckAction={taskId:string;ackId:string;mode:"seen"|"completed"};
export function parseNotificationAction(search:string):NotificationAckAction|undefined{
 const params=new URLSearchParams(search);
 const taskId=params.get("taskAckTask")?.trim();
 const ackId=params.get("taskAckId")?.trim();
 const action=params.get("taskAckAction");
 if(!taskId||!ackId||(action!=="seen"&&action!=="completed"))return undefined;
 return {taskId,ackId,mode:action};
}
