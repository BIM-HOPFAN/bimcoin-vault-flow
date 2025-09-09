import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Trophy, ExternalLink } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';

interface Task {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: 'social' | 'trading' | 'referral';
  completed: boolean;
  url?: string;
}

const TaskCard = () => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Follow on Twitter',
      description: 'Follow @BIMCoin_Official on Twitter',
      reward: 10,
      type: 'social',
      completed: false,
      url: 'https://twitter.com/bimcoin_official'
    },
    {
      id: '2',
      title: 'Join Telegram',
      description: 'Join our official Telegram channel',
      reward: 15,
      type: 'social',
      completed: false,
      url: 'https://t.me/bimcoin_official'
    },
    {
      id: '3',
      title: 'Make First Trade',
      description: 'Complete your first deposit transaction',
      reward: 50,
      type: 'trading',
      completed: false,
    },
    {
      id: '4',
      title: 'Refer a Friend',
      description: 'Invite someone using your referral link',
      reward: 100,
      type: 'referral',
      completed: false,
    }
  ]);

  const address = useTonAddress();
  const { toast } = useToast();

  const completeTask = (taskId: string) => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to complete tasks",
        variant: "destructive",
      });
      return;
    }

    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, completed: true }
          : task
      )
    );

    const task = tasks.find(t => t.id === taskId);
    if (task) {
      toast({
        title: "Task completed!",
        description: `You earned ${task.reward} OBA tokens`,
        variant: "default",
      });
    }
  };

  const getTypeColor = (type: Task['type']) => {
    switch (type) {
      case 'social': return 'bg-blue-500/20 text-blue-400';
      case 'trading': return 'bg-green-500/20 text-green-400';
      case 'referral': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const totalRewards = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.reward, 0);

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          Daily Tasks
        </CardTitle>
        <CardDescription>
          Complete tasks to earn OBA tokens. Get 3% OBA daily for active participation!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="text-2xl font-bold text-warning">{totalRewards}</div>
          <div className="text-sm text-muted-foreground">Total OBA Earned</div>
        </div>

        <div className="space-y-3">
          {tasks.map((task) => (
            <div 
              key={task.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{task.title}</span>
                  <Badge className={getTypeColor(task.type)}>
                    {task.type}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{task.description}</p>
                <div className="text-sm font-medium text-warning">+{task.reward} OBA</div>
              </div>

              <div className="flex items-center gap-2">
                {task.url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(task.url, '_blank')}
                    className="p-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
                
                {task.completed ? (
                  <CheckCircle className="w-6 h-6 text-success" />
                ) : (
                  <Button
                    size="sm"
                    onClick={() => completeTask(task.id)}
                    disabled={!address}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    Complete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskCard;