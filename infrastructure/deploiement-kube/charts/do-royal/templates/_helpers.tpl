{{- define "do-royal.name" -}}
do-royal
{{- end -}}

{{- define "do-royal.namespace" -}}
{{ .Values.global.environment | default .Release.Namespace }}
{{- end -}}

{{- define "do-royal.labels" -}}
app.kubernetes.io/name: {{ include "do-royal.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: do-royal
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
environment: {{ .Values.global.environment | quote }}
{{- end -}}

{{- define "do-royal.image" -}}
{{ .repository }}:{{ .tag }}
{{- end -}}
