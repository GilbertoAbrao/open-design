# Traceway no daemon

O daemon exporta spans manuais para o Traceway quando WXCODE_TELEMETRY_ENABLED
está habilitado e o contrato de endpoint, token, ambiente e versão está completo.
A amostragem usa WXCODE_TELEMETRY_SAMPLE_RATIO (o contrato de produção mantém
1.0).

## Identidade WXCode

WXCODE_TENANT_ID é a identidade confiável do runtime, injetada pelo
control-plane/chat-runtime. Ela só é aceita no formato UUID canônico e é
adicionada pelo processor a todos os spans manuais, inclusive HTTP, ciclo de
vida, falha fatal, erro de modelo e critique. O daemon nunca deriva tenant de
header, query, body ou texto do usuário.

Os únicos atributos de identidade permitidos pelo exporter são
wxcode.tenant.id e wxcode.output_project.id; ambos exigem UUID canônico.
wxcode.output_project.id é best effort e deve ser preenchido somente após
lookup de binding validado. Ausência não impede a emissão. Nenhum metadata livre
é exportado.

Open Design executa dentro do chat-runtime; portanto a propagação de tenant
no processo/worker é responsabilidade do runtime manager e do control-plane.
A atualização do pin de runtime em wxcode-chat (.wxk/runtime-pins.json)
deve apontar para a imagem/artefato publicado que contenha este commit, usando o
fluxo normal de release; não se deve editar o pin de produção manualmente.
