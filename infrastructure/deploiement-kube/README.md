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

Le coffre Vault prod doit exposer le secret `prod/do-royal` avec au minimum:

- `PG_PASSWORD`
- `JWT_SECRET`

## Verification

```bash
helm lint infrastructure/deploiement-kube/charts/do-royal \
  --values infrastructure/deploiement-kube/charts/do-royal/environments/prod.yaml

helm template do-royal-prod infrastructure/deploiement-kube/charts/do-royal \
  --namespace prod \
  --values infrastructure/deploiement-kube/charts/do-royal/environments/prod.yaml
```
