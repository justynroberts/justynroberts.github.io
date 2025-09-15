# Kubernetes Deployment Failure Incident Runbook

## Overview
This runbook addresses the critical web-api deployment failure in the production Kubernetes cluster, involving multiple interconnected issues including CrashLoopBackOff, ImagePullBackOff, health check failures, memory limits, and service endpoint issues.

## Incident Summary
- **Service**: web-api
- **Environment**: production
- **Cluster**: us-west-2a
- **Namespace**: production
- **Deployment**: web-api-deployment
- **Image**: nginx:1.25-alpine
- **Expected Replicas**: 3
- **Available Replicas**: 0

## Alert Context
Multiple alerts fired simultaneously, indicating a cascading failure:
1. Pod CrashLoopBackOff (Critical)
2. ImagePullBackOff Error
3. Liveness Probe Failures (Warning)
4. OOMKilled - Memory Limit Exceeded (Critical)
5. Service Endpoints Not Ready (Error)

---

## Immediate Response (0-5 minutes)

### Step 1: Acknowledge Alerts
- [ ] Acknowledge all related PagerDuty alerts
- [ ] Join #incident-response Slack channel
- [ ] Page on-call SRE if not already engaged

### Step 2: Initial Assessment
```bash
# Check cluster status
kubectl get nodes --show-labels

# Check deployment status
kubectl get deployment web-api-deployment -n production -o wide

# Get pod status and events
kubectl get pods -n production -l app=web-api
kubectl describe pod -n production -l app=web-api
```

### Step 3: Immediate Rollback Decision
If this is a recent deployment:
```bash
# Check rollout history
kubectl rollout history deployment/web-api-deployment -n production

# Rollback to previous version if needed
kubectl rollout undo deployment/web-api-deployment -n production
```

---

## Detailed Investigation (5-15 minutes)

### Pod-Level Analysis

#### 1. Check Pod Events and Logs
```bash
# Get detailed pod information
kubectl describe pods -n production -l app=web-api

# Check pod logs (current and previous)
kubectl logs -n production -l app=web-api --previous
kubectl logs -n production -l app=web-api --tail=100
```

#### 2. Resource Utilization Check
```bash
# Check resource usage
kubectl top pods -n production -l app=web-api

# Check resource limits and requests
kubectl get pods -n production -l app=web-api -o jsonpath='{.items[*].spec.containers[*].resources}'
```

### Image and Registry Issues

#### 1. Verify Image Availability
```bash
# Check if image exists in registry
docker pull nginx:1.25-alpine

# Check image digest
kubectl get deployment web-api-deployment -n production -o jsonpath='{.spec.template.spec.containers[0].image}'

# Verify image pull secrets
kubectl get secrets -n production | grep regcred
kubectl describe secret regcred -n production
```

#### 2. Registry Authentication
```bash
# Test registry connectivity
nslookup registry-1.docker.io

# Check node's ability to pull images
# (Run on affected nodes via SSH or node debugging)
crictl images | grep nginx
crictl pull nginx:1.25-alpine
```

### Network and Service Issues

#### 1. Service and Endpoint Analysis
```bash
# Check service configuration
kubectl get svc web-api-service -n production -o yaml

# Check endpoints
kubectl get endpoints web-api-service -n production

# Verify service selector matches pod labels
kubectl get pods -n production -l app=web-api --show-labels
```

#### 2. Network Policy and DNS
```bash
# Check network policies
kubectl get networkpolicies -n production

# Test DNS resolution from a pod
kubectl run debug-pod --image=busybox:1.28 --rm -it --restart=Never -- nslookup web-api-service.production.svc.cluster.local
```

### Health Check Investigation

#### 1. Liveness and Readiness Probes
```bash
# Check probe configuration
kubectl get deployment web-api-deployment -n production -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}'
kubectl get deployment web-api-deployment -n production -o jsonpath='{.spec.template.spec.containers[0].readinessProbe}'
```

#### 2. Manual Health Check Test
```bash
# Port-forward to test health endpoint directly
kubectl port-forward -n production deployment/web-api-deployment 8080:8080

# Test health endpoint (in another terminal)
curl -v http://localhost:8080/health
```

---

## Third-Party Dependencies & External Context

### Container Registry (Docker Hub)
- **Service**: Docker Hub Registry
- **Status Page**: https://status.docker.com/
- **Rate Limits**: 200 pulls/6h for anonymous, 5000/day for authenticated
- **Common Issues**:
  - Rate limiting (HTTP 429)
  - Registry downtime
  - Image layer corruption

### Monitoring & Observability Stack

#### Prometheus/Grafana
- **Metrics Dashboard**: https://grafana.example.com/d/kubernetes-deployments
- **Key Metrics**:
  - `kube_deployment_status_replicas_unavailable`
  - `kube_pod_container_status_restarts_total`
  - `container_memory_usage_bytes`

#### Datadog/New Relic
- **APM Dashboard**: Check application traces for upstream dependencies
- **Infrastructure**: Monitor cluster resource utilization
- **Logs**: Aggregate application logs for error patterns

### AWS Dependencies (if using EKS)
- **EKS Cluster Status**: Check AWS Service Health Dashboard
- **Node Groups**: Verify EC2 instances are healthy
- **Load Balancer**: Check ALB target group health
- **VPC/Security Groups**: Ensure proper connectivity

### Internal Dependencies
- **Configuration Management**: Check if ConfigMaps/Secrets were updated
- **CI/CD Pipeline**: Verify last deployment didn't introduce issues
- **Database**: Check if database migrations or schema changes occurred
- **Upstream Services**: Verify dependencies are responding correctly

---

## Resolution Steps

### For ImagePullBackOff Issues

#### 1. Registry Authentication
```bash
# Update image pull secret if expired
kubectl create secret docker-registry regcred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username=<username> \
  --docker-password=<password> \
  --docker-email=<email> \
  --namespace=production

# Update deployment to use secret
kubectl patch deployment web-api-deployment -n production -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}'
```

#### 2. Image Tag Verification
```bash
# Verify image exists and tag is correct
docker manifest inspect nginx:1.25-alpine

# If image doesn't exist, update to known good version
kubectl set image deployment/web-api-deployment -n production web-api=nginx:1.24-alpine
```

### For Memory/Resource Issues

#### 1. Increase Resource Limits
```bash
# Update memory limits
kubectl patch deployment web-api-deployment -n production -p '{"spec":{"template":{"spec":{"containers":[{"name":"web-api","resources":{"limits":{"memory":"1Gi"},"requests":{"memory":"512Mi"}}}]}}}}'
```

#### 2. Horizontal Pod Autoscaler
```bash
# Check HPA configuration
kubectl get hpa web-api-hpa -n production

# Create HPA if not exists
kubectl autoscale deployment web-api-deployment --cpu-percent=50 --min=3 --max=10 -n production
```

### For Health Check Issues

#### 1. Adjust Probe Timing
```bash
# Increase probe timeout and delay
kubectl patch deployment web-api-deployment -n production -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "web-api",
          "livenessProbe": {
            "initialDelaySeconds": 60,
            "timeoutSeconds": 10,
            "failureThreshold": 5
          }
        }]
      }
    }
  }
}'
```

#### 2. Temporary Probe Removal
```bash
# Remove problematic probes temporarily
kubectl patch deployment web-api-deployment -n production --type='json' \
  -p='[{"op": "remove", "path": "/spec/template/spec/containers/0/livenessProbe"}]'
```

---

## Verification Steps

### 1. Deployment Health
```bash
# Wait for rollout to complete
kubectl rollout status deployment/web-api-deployment -n production --timeout=300s

# Verify all pods are running
kubectl get pods -n production -l app=web-api
```

### 2. Service Connectivity
```bash
# Check service endpoints
kubectl get endpoints web-api-service -n production

# Test service connectivity
kubectl run test-pod --image=busybox:1.28 --rm -it --restart=Never -- wget -qO- http://web-api-service.production.svc.cluster.local:8080/health
```

### 3. Application Health
```bash
# Check application metrics
curl -s http://prometheus.example.com/api/v1/query?query=up{job="web-api"}

# Verify load balancer health
curl -s https://alb.us-west-2.elb.amazonaws.com/health
```

---

## Post-Incident Actions

### 1. Incident Documentation
- [ ] Update incident timeline in PagerDuty
- [ ] Document root cause in incident report
- [ ] Share lessons learned with team

### 2. Preventive Measures
- [ ] Implement image scanning in CI/CD pipeline
- [ ] Add resource monitoring alerts
- [ ] Review deployment process and testing
- [ ] Update runbook based on new findings

### 3. Technical Improvements
- [ ] Implement blue-green or canary deployments
- [ ] Add pre-deployment validation hooks
- [ ] Improve health check endpoint reliability
- [ ] Set up automated rollback triggers

---

## Key Customers

Blue Carpet - SLA 99.9


---

## Additional Resources

- [Kubernetes Troubleshooting Guide](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Container Image Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Prometheus Monitoring Queries](https://prometheus.io/docs/prometheus/latest/querying/basics/)

## Quick Reference Commands

```bash
# Emergency rollback
kubectl rollout undo deployment/web-api-deployment -n production

# Scale down to zero (emergency stop)
kubectl scale deployment web-api-deployment --replicas=0 -n production

# Debug pod creation
kubectl run debug-pod --image=busybox:1.28 --rm -it --restart=Never -- sh

# Port forwarding for local testing
kubectl port-forward -n production svc/web-api-service 8080:8080
```

---

**Last Updated**: 2024-09-14
**Runbook Version**: 1.2
**Next Review Date**: 2024-12-14
