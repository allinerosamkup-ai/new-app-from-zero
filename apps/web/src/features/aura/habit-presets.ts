export type HabitSuggestion = {
  title: string;
  icon: string;
  category: string;
  theme: "starter" | "autocuidado" | "casa" | "social" | "criativo" | "natureza";
  timeOfDay: "morning" | "afternoon" | "evening" | "anytime";
  durationMinutes: number;
  socialProof?: number; // % de usuários que praticam este hábito
};

export const HABIT_SUGGESTIONS: HabitSuggestion[] = [
  { title: "Arrumar a cama", icon: "🛏️", category: "productivity", theme: "starter", timeOfDay: "morning", durationMinutes: 5, socialProof: 78 },
  { title: "Beber água ao acordar", icon: "💧", category: "health", theme: "starter", timeOfDay: "morning", durationMinutes: 2, socialProof: 84 },
  { title: "Abrir a janela e pegar sol", icon: "☀️", category: "health", theme: "starter", timeOfDay: "morning", durationMinutes: 10, socialProof: 61 },
  { title: "Alongamento suave", icon: "🤸", category: "health", theme: "starter", timeOfDay: "morning", durationMinutes: 10, socialProof: 55 },
  { title: "Respiração consciente", icon: "🌬️", category: "mindfulness", theme: "starter", timeOfDay: "anytime", durationMinutes: 5, socialProof: 49 },
  { title: "Planejar 3 prioridades", icon: "🎯", category: "productivity", theme: "starter", timeOfDay: "morning", durationMinutes: 5, socialProof: 67 },
  { title: "Organizar a mesa", icon: "🧹", category: "productivity", theme: "casa", timeOfDay: "morning", durationMinutes: 10, socialProof: 43 },
  { title: "Separar a roupa do dia seguinte", icon: "👕", category: "productivity", theme: "casa", timeOfDay: "evening", durationMinutes: 5 },
  { title: "Guardar 5 coisas fora do lugar", icon: "🧺", category: "productivity", theme: "casa", timeOfDay: "anytime", durationMinutes: 5 },
  { title: "Lavar a louça logo depois", icon: "🍽️", category: "productivity", theme: "casa", timeOfDay: "anytime", durationMinutes: 10, socialProof: 38 },
  { title: "Arrumar bolsa ou mochila", icon: "🎒", category: "productivity", theme: "casa", timeOfDay: "evening", durationMinutes: 5 },
  { title: "Checar a agenda de amanhã", icon: "🗓️", category: "productivity", theme: "starter", timeOfDay: "evening", durationMinutes: 5, socialProof: 52 },
  { title: "Meditação curta", icon: "🧘", category: "mindfulness", theme: "autocuidado", timeOfDay: "morning", durationMinutes: 10, socialProof: 41 },
  { title: "Journaling", icon: "📔", category: "mindfulness", theme: "autocuidado", timeOfDay: "evening", durationMinutes: 10, socialProof: 36 },
  { title: "Lista de gratidão", icon: "🙏", category: "mindfulness", theme: "autocuidado", timeOfDay: "evening", durationMinutes: 5, socialProof: 44 },
  { title: "Fazer ioga", icon: "🪷", category: "health", theme: "autocuidado", timeOfDay: "morning", durationMinutes: 20, socialProof: 29 },
  { title: "Caminhada curta", icon: "🚶", category: "health", theme: "autocuidado", timeOfDay: "morning", durationMinutes: 20, socialProof: 71 },
  { title: "Caminhada sem celular", icon: "🚶‍♀️", category: "mindfulness", theme: "autocuidado", timeOfDay: "afternoon", durationMinutes: 20, socialProof: 33 },
  { title: "Alongar ombros e pescoço", icon: "🙆", category: "health", theme: "autocuidado", timeOfDay: "afternoon", durationMinutes: 5, socialProof: 47 },
  { title: "Fazer skincare", icon: "🫧", category: "health", theme: "autocuidado", timeOfDay: "evening", durationMinutes: 10, socialProof: 58 },
  { title: "Passar protetor solar", icon: "🧴", category: "health", theme: "autocuidado", timeOfDay: "morning", durationMinutes: 2, socialProof: 62 },
  { title: "Dormir no mesmo horário", icon: "🌙", category: "health", theme: "autocuidado", timeOfDay: "evening", durationMinutes: 0, socialProof: 53 },
  { title: "Sem tela antes de dormir", icon: "📵", category: "health", theme: "autocuidado", timeOfDay: "evening", durationMinutes: 30, socialProof: 46 },
  { title: "Pausa sem notificações", icon: "🔕", category: "mindfulness", theme: "autocuidado", timeOfDay: "anytime", durationMinutes: 10, socialProof: 39 },
  { title: "Ficar 10 min em silêncio", icon: "🤍", category: "mindfulness", theme: "autocuidado", timeOfDay: "anytime", durationMinutes: 10 },
  { title: "Ouvir uma música com atenção", icon: "🎵", category: "leisure", theme: "criativo", timeOfDay: "anytime", durationMinutes: 4, socialProof: 57 },
  { title: "Desenho rápido", icon: "🎨", category: "leisure", theme: "criativo", timeOfDay: "anytime", durationMinutes: 10 },
  { title: "Escrever uma ideia criativa", icon: "💡", category: "learning", theme: "criativo", timeOfDay: "anytime", durationMinutes: 5 },
  { title: "Ler 10 páginas", icon: "📚", category: "learning", theme: "criativo", timeOfDay: "evening", durationMinutes: 15, socialProof: 48 },
  { title: "Aprender uma palavra nova", icon: "🧠", category: "learning", theme: "criativo", timeOfDay: "anytime", durationMinutes: 5 },
  { title: "Ler ao ar livre", icon: "🌳", category: "learning", theme: "natureza", timeOfDay: "afternoon", durationMinutes: 15 },
  { title: "Cozinhar algo simples", icon: "🥣", category: "leisure", theme: "criativo", timeOfDay: "evening", durationMinutes: 20, socialProof: 42 },
  { title: "Mandar mensagem carinhosa", icon: "💌", category: "social", theme: "social", timeOfDay: "anytime", durationMinutes: 5, socialProof: 65 },
  { title: "Ligar para alguém querido", icon: "☎️", category: "social", theme: "social", timeOfDay: "evening", durationMinutes: 10, socialProof: 37 },
  { title: "Elogiar alguém hoje", icon: "🌷", category: "social", theme: "social", timeOfDay: "anytime", durationMinutes: 2, socialProof: 44 },
  { title: "Tomar café sem pressa", icon: "☕", category: "mindfulness", theme: "starter", timeOfDay: "morning", durationMinutes: 10, socialProof: 73 },
  { title: "Preparar o café da manhã", icon: "🍳", category: "health", theme: "starter", timeOfDay: "morning", durationMinutes: 15, socialProof: 66 },
  { title: "Regar as plantas", icon: "🪴", category: "leisure", theme: "natureza", timeOfDay: "morning", durationMinutes: 5, socialProof: 34 },
  { title: "Cuidar da horta", icon: "🌿", category: "leisure", theme: "natureza", timeOfDay: "afternoon", durationMinutes: 15 },
  { title: "Plantar uma semente", icon: "🌱", category: "leisure", theme: "natureza", timeOfDay: "afternoon", durationMinutes: 10 },
  { title: "Tomar ar livre", icon: "🌤️", category: "health", theme: "natureza", timeOfDay: "afternoon", durationMinutes: 15, socialProof: 59 },
  { title: "Revisar gastos do dia", icon: "💸", category: "productivity", theme: "starter", timeOfDay: "evening", durationMinutes: 5, socialProof: 31 },
  { title: "Anotar uma vitória do dia", icon: "⭐", category: "mindfulness", theme: "autocuidado", timeOfDay: "evening", durationMinutes: 3, socialProof: 45 },
];
