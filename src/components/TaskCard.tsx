import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Trophy, ExternalLink, RefreshCw } from 'lucide-react';
import { useTonAddress } from '@tonconnect/ui-react';
import { useToast } from '@/hooks/use-toast';
import { bimCoinAPI } from '@/lib/api';

interface Task {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  task_type: string;
  external_url?: string;
  status?: string;
  completed?: boolean;
  verification_type?: string;
  completion_timeout?: number;
}

const TaskCard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const address = useTonAddress();
  const { toast } = useToast();

  // Fetch available tasks from API
  const fetchTasks = async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      const result = await bimCoinAPI.getAvailableTasks(address);
      if (result.success && result.data) {
        setTasks(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast({
        title: "Failed to load tasks",
        description: "There was an error loading available tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchTasks();
    } else {
      setTasks([]);
    }
  }, [address]);

  const completeTask = async (taskId: string) => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your TON wallet to complete tasks",
        variant: "destructive",
      });
      return;
    }

    setCompletingTasks(prev => new Set(prev).add(taskId));
    try {
      const task = tasks.find(t => t.id === taskId);
      let verificationData = {};

      // Handle different verification types
      if (task?.verification_type === 'url_visit' && task.external_url) {
        verificationData = { visited_url: task.external_url };
      } else if (task?.verification_type === 'time_based') {
        verificationData = { start_time: new Date().toISOString() };
        // For time-based tasks, show a waiting period
        toast({
          title: "Task started",
          description: "Please wait for the completion timer...",
        });
        await new Promise(resolve => setTimeout(resolve, (task.completion_timeout || 5) * 1000));
      }

      const result = await bimCoinAPI.completeTask(address, taskId, verificationData);
      if (result.success) {
        toast({
          title: "Task completed!",
          description: `You earned ${task?.reward_amount || 0} OBA tokens${result.verification_status ? ' (Verified)' : ''}`,
          variant: "default",
        });
        await fetchTasks(); // Refresh tasks
      } else {
        throw new Error(result.error || 'Failed to complete task');
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast({
        title: "Failed to complete task",
        description: error instanceof Error ? error.message : "There was an error completing the task",
        variant: "destructive",
      });
    } finally {
      setCompletingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(taskId);
        return newSet;
      });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'social': return 'bg-blue-500/20 text-blue-400';
      case 'trading': return 'bg-green-500/20 text-green-400';
      case 'referral': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const totalRewards = tasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.reward_amount, 0);

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
        <div className="flex justify-between items-center">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-warning">{totalRewards}</div>
            <div className="text-sm text-muted-foreground">Total OBA Earned</div>
          </div>
          <Button
            onClick={fetchTasks}
            disabled={loading || !address}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="space-y-3">
          {loading && tasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No tasks available</div>
          ) : (
            tasks.map((task) => (
            <div 
              key={task.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
            >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.title}</span>
                    <Badge className={getTypeColor(task.task_type)}>
                      {task.task_type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  <div className="text-sm font-medium text-warning">+{task.reward_amount} OBA</div>
                </div>

                <div className="flex items-center gap-2">
                  {task.external_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(task.external_url, '_blank')}
                      className="p-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {task.status === 'completed' ? (
                    <CheckCircle className="w-6 h-6 text-success" />
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => completeTask(task.id)}
                      disabled={!address || completingTasks.has(task.id)}
                      className="bg-gradient-primary hover:opacity-90"
                    >
                      {completingTasks.has(task.id) ? "Completing..." : "Complete"}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskCard;