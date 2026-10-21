---
impacto: capacidade_nova
secao: adicionado
titulo: Cada empresa escolhe se vende para empresas (B2B) ou para pessoas (B2C)
---

Nova chave por organização, "Tipo de cliente", no cadastro de empresa nova (`/admin/tenants/new`)
e em Configurações › Organização (administrador). Padrão: Empresas (B2B), igual a antes; quem
nunca escolheu nada não vê diferença. Em Pessoas (B2C), o cadastro do contato (Novo contato,
Editar contato, ficha, painel e lista do Inbox) esconde Empresa, CNPJ, Segmentos e como conheceu e
passa a ter só CPF (com máscara e conferência dos dígitos) e data de nascimento; o menu e as rotas
de Empresas/Pessoas somem para essa organização; a API de contatos ignora empresa, CNPJ e
segmentos; e a ferramenta `registrar_dados_do_lead` do agente deixa de oferecer empresa/CNPJ e
passa a aceitar CPF e data de nascimento. O CPF continua cifrado como no resto do produto e não
aparece em listas. Trocar de modo não apaga nada: os dados só ficam escondidos.
