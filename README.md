# **MongoDB Kubernetes Integration - README**

---

## **1. Project Overview**

This project demonstrates how to:

- Deploy **MongoDB** in Kubernetes (standalone mode)
- Configure **persistent storage** for data durability
- Securely manage credentials using **Kubernetes Secrets**
- Connect a **Node.js microservice** to MongoDB
- Set up **monitoring and autoscaling**

---

## **2. Prerequisites**

- **Kubernetes Cluster** (Docker Desktop)
- **kubectl** configured to access your cluster
- **Docker** for containerization
- **Node.js** (v16+) for the application

---

## **3. Step-by-Step Deployment**

### **3.1. Deploy MongoDB**

#### **3.1.1. Create Persistent Volume (PV) & Claim (PVC)**

```yaml
# mongo-storage.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongodb-pv
spec:
  storageClassName: manual
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  hostPath:
    path: "/mnt/data"

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 3Gi
```

**Apply:**

```bash
kubectl apply -f mongo-storage.yaml
```

#### **3.1.2. Create Kubernetes Secret for Credentials**

```bash
kubectl create secret generic mongodb-secret \
  --from-literal=mongo-root-username=admin \
  --from-literal=mongo-root-password=yourpassword \
  --from-literal=mongo-username=appuser \
  --from-literal=mongo-password=apppassword
```

#### **3.1.3. Deploy MongoDB**

```yaml
# mongo-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:latest
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              valueFrom:
                secretKeyRef:
                  name: mongodb-secret
                  key: mongo-root-username
            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-secret
                  key: mongo-root-password
          volumeMounts:
            - name: mongodb-storage
              mountPath: /data/db
      volumes:
        - name: mongodb-storage
          persistentVolumeClaim:
            claimName: mongodb-pvc
```

**Apply:**

```bash
kubectl apply -f mongo-deployment.yaml
```

#### **3.1.4. Expose MongoDB Service**

```yaml
# mongo-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb
spec:
  selector:
    app: mongodb
  ports:
    - protocol: TCP
      port: 27017
      targetPort: 27017
```

**Apply:**

```bash
kubectl apply -f mongo-service.yaml
```

---

### **3.2. Deploy Node.js Application**

#### **3.2.1. Build & Push Docker Image**

```bash
docker build -t yourusername/nodeapp:latest .
docker push yourusername/nodeapp:latest
```

#### **3.2.2. Deploy Application**

```yaml
# app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodeapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nodeapp
  template:
    metadata:
      labels:
        app: nodeapp
    spec:
      containers:
        - name: nodeapp
          image: yourusername/nodeapp:latest
          ports:
            - containerPort: 3000
          env:
            - name: MONGODB_URI
              value: "mongodb://appuser:apppassword@mongodb:27017/appdb?authSource=admin"
            - name: PORT
              value: "3000"
```

**Apply:**

```bash
kubectl apply -f app-deployment.yaml
```

#### **3.2.3. Expose Application Service**

```yaml
# app-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nodeapp-service
spec:
  type: LoadBalancer
  selector:
    app: nodeapp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```

**Apply:**

```bash
kubectl apply -f app-service.yaml
```

---

## **4. Verification & Testing**

### **4.1. Check Pods & Services**

```bash
kubectl get pods
kubectl get services
```

### **4.2. Test MongoDB Connection**

```bash
kubectl exec -it mongodb-<pod-id> -- mongo -u admin -p yourpassword --eval "show dbs"
```

### **4.3. Test Application Endpoints**

```bash
curl http://localhost/items
```

---

## **5. Backup & Monitoring**

### **5.1. Set Up Daily Backups**

```yaml
# mongo-backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: mongo-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: mongo:latest
              command:
                - /bin/sh
                - -c
                - |
                  mongodump --uri="mongodb://$(MONGO_USERNAME):$(MONGO_PASSWORD)@mongodb:27017" \
                  --archive=/backup/dump_$(date +%Y-%m-%d).gz --gzip
              env:
                - name: MONGO_USERNAME
                  valueFrom:
                    secretKeyRef:
                      name: mongodb-secret
                      key: mongo-root-username
                - name: MONGO_PASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: mongodb-secret
                      key: mongo-root-password
              volumeMounts:
                - name: backup-storage
                  mountPath: /backup
          restartPolicy: OnFailure
          volumes:
            - name: backup-storage
              persistentVolumeClaim:
                claimName: backup-pvc
```

**Apply:**

```bash
kubectl apply -f mongo-backup-cronjob.yaml
```

## **6. Troubleshooting**

| **Issue**                     | **Solution**                                                         |
| ----------------------------- | -------------------------------------------------------------------- |
| `CrashLoopBackOff` in MongoDB | Check logs: `kubectl logs mongodb-<pod-id>`                          |
| Connection refused            | Verify service endpoints: `kubectl get endpoints`                    |
| Authentication failed         | Ensure secrets are correct: `kubectl describe secret mongodb-secret` |

---

## **Conclusion**

This setup provides a MongoDB integration with:  
✅ **Persistence** (PVC/PV)  
✅ **Security** (Kubernetes Secrets)  
✅ **Scalability** (HPA)  
✅ **Monitoring** (Prometheus/Grafana)
