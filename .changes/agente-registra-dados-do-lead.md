---
impacto: capacidade_nova
secao: adicionado
titulo: O agente grava nome, empresa e CNPJ do lead direto no CRM
---

Nova ferramenta do agente, `registrar_dados_do_lead`: assim que a pessoa diz o nome, a empresa,
o CNPJ, o e-mail, o segmento, como conheceu e quem indicou, o agente grava isso no cadastro,
sem esperar uma pessoa confirmar (a ferramenta de proposta de campo continua existindo, mas só
propõe). O nome vai para o contato; a empresa e o CNPJ viram um registro em Empresas (sem
duplicar: o mesmo CNPJ reaproveita a empresa), a pessoa é ligada à empresa, e segmento, origem
e indicação ficam em `custom_fields` do contato. O CNPJ só confere os 14 números; a consulta
na BrasilAPI fica pendente para o enriquecimento que já existe.
