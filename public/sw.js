self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const action=event.action;
 const data=event.notification.data||{};
 if(!data.taskId||!data.ackId)return;
 if(action!=="seen"&&action!=="completed")return;
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(async clients=>{
  if(clients.length){
   const client=clients[0];
   client.postMessage({type:"task-ack",taskId:data.taskId,ackId:data.ackId,action});
   if(client.focus)await client.focus();
   return;
  }
  const target=new URL("./",self.location.href);
  target.searchParams.set("taskAckTask",data.taskId);
  target.searchParams.set("taskAckId",data.ackId);
  target.searchParams.set("taskAckAction",action);
  await self.clients.openWindow(target.href);
 }));
});
