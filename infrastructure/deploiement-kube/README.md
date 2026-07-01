# Deploiement Kubernetes DO Royal

Ce dossier contient le chart Helm applicatif et l'ApplicationSet Argo CD pour deployer DO Royal sur `do-royal.polydo.dev`.

## Flux GitOps

1. Un tag SemVer `vX.Y.Z` declenche le workflow `Release`.
2. Le workflow build et pousse les images:
   - `ghcr.io/laflut3/do-royal-backend:X.Y.Z`
   - `ghcr.io/laflut3/do-royal-frontend:X.Y.Z`
3. Le workflow modifie `charts/do-royal/environments/prod.yaml` sur `main`.
4. Argo CD suit `main` et synchronise automatiquement la prod.

GitHub Actions n'a pas besoin de kubeconfig. Le cluster lit seulement l'etat Git via Argo CD.

## Activation Argo CD

Depuis la racine du depot, apres merge sur `main`:

```bash
kubectl apply -f infrastructure/deploiement-kube/gitops/argocd/applicationset.yaml
kubectl -n argocd get applications,applicationsets
kubectl -n argocd get application do-royal-prod
```

## Configuration GitHub

Si `main` est protegee, creer un secret `GITOPS_TOKEN` avec les droits `Contents: Read and write` sur ce repository. Sinon le workflow utilise `GITHUB_TOKEN`.

Le registry utilise `GITHUB_TOKEN` pour publier dans GHCR. Si les packages sont prives, configurer un `imagePullSecret` dans `global.imagePullSecrets`.

Le coffre Vault prod utilise le moteur KV v2 monte sur `secret`, comme Let-Note.
Le secret applicatif est donc `secret/prod/do-royal`, ce qui correspond au chemin API `/v1/secret/data/prod/do-royal`.
Les pods utilisent l'auth Kubernetes Vault avec le ServiceAccount `do-royal-backend` dans le namespace `prod` et le role Vault `do-royal-prod`.

Le secret doit contenir:

- `SERVER_PORT` avec la valeur `8080`
- `JDBC_DATABASE_URL` avec la valeur `jdbc:postgresql://do-royal-postgres:5432/do_royal`
- `POSTGRES_DB` avec la valeur `do_royal`
- `POSTGRES_USER` avec la valeur `do_royal`
- `POSTGRES_PASSWORD` avec le mot de passe Postgres prod
- `DO_ROYAL_JWT_SECRET` avec une valeur longue et aleatoire

Configuration Vault attendue:

```bash
vault kv put secret/prod/do-royal \
  SERVER_PORT="8080" \
  JDBC_DATABASE_URL="jdbc:postgresql://do-royal-postgres:5432/do_royal" \
  POSTGRES_DB="do_royal" \
  POSTGRES_USER="do_royal" \
  POSTGRES_PASSWORD="mot-de-passe-postgres-prod" \
  DO_ROYAL_JWT_SECRET="secret-jwt-prod-long-et-aleatoire"

vault policy write do-royal-prod - <<'HCL'
path "secret/data/prod/do-royal" {
  capabilities = ["read"]
}
HCL

vault write auth/kubernetes/role/do-royal-prod \
  bound_service_account_names="do-royal-backend" \
  bound_service_account_namespaces="prod" \
  policies="do-royal-prod" \
  ttl="1h"
```

## Verification

```bash
helm lint infrastructure/deploiement-kube/charts/do-royal \
  --values infrastructure/deploiement-kube/charts/do-royal/environments/prod.yaml

helm template do-royal-prod infrastructure/deploiement-kube/charts/do-royal \
  --namespace prod \
  --values infrastructure/deploiement-kube/charts/do-royal/environments/prod.yaml
```
