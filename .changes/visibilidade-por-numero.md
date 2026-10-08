---
impacto: nada_mudou
secao: adicionado
titulo: Cada vendedor vê só o próprio número (opcional)
---

Em Configurações › Atendimento, a caixa "Cada vendedor vê só os números em que é responsável"
faz cada atendente ver todas as conversas dos números em que está marcado em "Responsáveis por
número" — com ou sem dono — e esconde as dos outros números, inclusive na lista de números do
inbox. Gerentes e administradores continuam vendo tudo. Nasce desligada. A regra mora no banco
(`supabase/personalizacoes.sql`, aplicado pelo `update.sh` depois do baseline).
