self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const action=event.action;
 const data=event.notification.data||{};
 if(!action||!data.taskId||!data.ackId)return;
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
  if(clients.length){clients[0].postMessage({type:"task-ack",taskId:data.taskId,ackId:data.ackId,action});return clients[0].focus?.();}
  return self.clients.openWindow("./").then(client=>client?.postMessage({type:"task-ack",taskId:data.taskId,ackId:data.ackId,action}));
 }));
});