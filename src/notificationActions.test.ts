import {describe,expect,it} from "vitest";
import {parseNotificationAction} from "./notificationActions";
describe("notification acknowledgement deep links",()=>{
 it("parses a valid seen action",()=>expect(parseNotificationAction("?taskAckTask=t1&taskAckId=a1&taskAckAction=seen")).toEqual({taskId:"t1",ackId:"a1",mode:"seen"}));
 it("parses a valid completion action",()=>expect(parseNotificationAction("?taskAckTask=t1&taskAckId=a1&taskAckAction=completed")?.mode).toBe("completed"));
 it("rejects missing IDs and unknown actions",()=>{
  expect(parseNotificationAction("?taskAckTask=t1&taskAckAction=seen")).toBeUndefined();
  expect(parseNotificationAction("?taskAckTask=t1&taskAckId=a1&taskAckAction=delete")).toBeUndefined();
 });
 it("trims IDs and decodes URL-encoded values",()=>expect(parseNotificationAction("?taskAckTask=%20task%201%20&taskAckId=ack%2F2&taskAckAction=seen")).toEqual({taskId:"task 1",ackId:"ack/2",mode:"seen"}));
});
