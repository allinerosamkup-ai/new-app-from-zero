export type ConcreteActionInput = {
  title: unknown;
  doneWhen?: unknown;
  starter?: unknown;
};

export type ConcreteActionVerdict =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'missing_title'
        | 'missing_executable_verb'
        | 'abstract_or_circular_action'
        | 'missing_specific_object'
        | 'missing_done_when';
    };

export const EXECUTABLE_VERB = /^(abra|abrir|anote|anotar|liste|listar|escreva|escrever|copie|copiar|meça|medir|ligue|ligar|mande|mandar|envie|enviar|selecione|selecionar|publique|publicar|edite|editar|responda|responder|pague|pagar|transfira|transferir|compare|comparar|reúna|reunir|separe|separar|retire|retirar|coloque|colocar|fotografe|fotografar|telefone|telefonar|preencha|preencher|agende|agendar|cancele|cancelar|confirme|confirmar|acesse|acessar|entre|entrar|baixe|baixar|anexe|anexar|assine|assinar|entregue|entregar|registre|registrar|identifique|identificar|monte|montar|crie|criar|marque|marcar|realize|realizar|leve|levar|enxágue|enxaguar|passe|passar|guarde|guardar|varra|varrer|corra|correr|caminhe|caminhar|cozinhe|cozinhar|leia|ler|saia|sair|deixe|deixar|tire|tirar|junte|juntar|open|write|copy|measure|list|call|send|select|publish|edit|reply|pay|transfer|compare|gather|remove|place|photograph|fill|schedule|cancel|confirm|access|download|attach|sign|deliver|record|identify|build|create|mark|take|rinse|wipe|store|sweep)\b/i;

const ABSTRACT_OPENERS = /^(escolha|escolher|considere|considerar|pense|pensar|reflita|refletir|planeje|planejar|organize|organizar|revise|revisar|resolva|resolver|decida|decidir|verifique|verificar|confira|conferir|avalie|avaliar|prepare|preparar|trate|tratar|lide|lidar|faça|fazer|comece|começar|adiantar)\b/i;

const ABSTRACT_OBJECT = /\b(uma?\s+)?(pend[eê]ncia|decis[aã]o|tarefa|coisa|algo|assunto|parte|passo|item|problema|situa[cç][aã]o|quest[ão]|prioridade|vida|planejamento|revis[aá]vel|importante|necess[aá]rio)\b/i;
