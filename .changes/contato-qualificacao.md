---
impacto: nada_mudou
secao: adicionado
titulo: Empresa, CNPJ e segmentos no cadastro do contato
---

O contato ganhou os campos Empresa, CNPJ e Segmentos (vários), visíveis na ficha e editáveis em
"Editar contato". São colunas de verdade na tabela `contacts` (`empresa`, `cnpj` só com os 14
números, `segmentos` lista), prontas para a integração com o CRM. A ferramenta
`registrar_dados_do_lead` da Clara grava nelas. O que já estava em `custom_fields` foi copiado.
